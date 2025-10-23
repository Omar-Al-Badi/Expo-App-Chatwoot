const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3001;

// Waha configuration
const WAHA_BASE_URL =
  process.env.WAHA_BASE_URL || "http://178.128.116.119:3000";
const WAHA_SESSION = process.env.WAHA_SESSION || "default";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";

let isClientReady = false;
let qrCodeData = null;
let businessWhatsAppNumber = null;

const inquiriesByMsgId = new Map();
const sseClients = new Map();
const pendingBySession = new Map();
const sessionTags = new Map();
const sessionActivity = new Map();

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function generateSessionTag() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tag = "";
  for (let i = 0; i < 4; i++) {
    tag += chars[Math.floor(Math.random() * chars.length)];
  }
  return tag;
}

function getTagForSession(sessionId) {
  if (!sessionTags.has(sessionId)) {
    let tag = generateSessionTag();
    while ([...sessionTags.values()].includes(tag)) {
      tag = generateSessionTag();
    }
    sessionTags.set(sessionId, tag);
  }
  return sessionTags.get(sessionId);
}

function updateSessionActivity(sessionId) {
  sessionActivity.set(sessionId, Date.now());
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [msgId, data] of inquiriesByMsgId.entries()) {
    if (now - data.createdAt > SESSION_TTL) {
      inquiriesByMsgId.delete(msgId);
    }
  }

  for (const [sessionId, lastActivity] of sessionActivity.entries()) {
    if (now - lastActivity > SESSION_TTL) {
      sessionTags.delete(sessionId);
      pendingBySession.delete(sessionId);
      sessionActivity.delete(sessionId);
      sseClients.delete(sessionId);
      console.log(`🧹 Cleaned up expired session: ${sessionId}`);
    }
  }
}

setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

app.use(cors());
app.use(bodyParser.json());
app.set("trust proxy", true);

const localhostOnly = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  if (
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp === "::ffff:127.0.0.1"
  ) {
    next();
  } else {
    res.status(403).json({ error: "Access denied" });
  }
};

const sendMessageRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: { error: "Too many messages. Please wait a minute." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// Helper function to make Waha API requests
async function wahaRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (WAHA_API_KEY) {
    headers["X-Api-Key"] = WAHA_API_KEY;
  }

  const url = `${WAHA_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Waha API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Send message via Waha
async function sendWahaMessage(chatId, text) {
  return await wahaRequest("/api/sendText", {
    method: "POST",
    body: JSON.stringify({
      session: WAHA_SESSION,
      chatId: chatId,
      text: text,
    }),
  });
}

// Check Waha session status
async function checkWahaStatus() {
  try {
    // Get all sessions and find ours
    const sessions = await wahaRequest("/api/sessions");
    const sessionData = sessions.find((s) => s.name === WAHA_SESSION);

    if (!sessionData) {
      console.log(
        `⚠️ Session "${WAHA_SESSION}" not found. Available sessions:`,
        sessions.map((s) => s.name),
      );
      isClientReady = false;
      return false;
    }

    console.log("📊 Session status:", sessionData.status);

    if (sessionData.status === "WORKING") {
      isClientReady = true;
      qrCodeData = null;

      // Get business WhatsApp number from session info
      if (sessionData.me && sessionData.me.id) {
        businessWhatsAppNumber = sessionData.me.id.split("@")[0];
        console.log("📱 Business WhatsApp Number:", businessWhatsAppNumber);
      }
      return true;
    } else if (sessionData.status === "SCAN_QR_CODE" && sessionData.qr) {
      isClientReady = false;
      qrCodeData = sessionData.qr;
      console.log("🔄 QR Code available, please scan");
      return false;
    } else {
      isClientReady = false;
      qrCodeData = null;
      console.log(`⏸️ Session status: ${sessionData.status}`);
      return false;
    }
  } catch (error) {
    console.error("Error checking Waha status:", error.message);
    isClientReady = false;
    return false;
  }
}

// Initialize and check status periodically
async function initializeWaha() {
  console.log("Initializing Waha connection...");
  console.log("Waha URL:", WAHA_BASE_URL);
  console.log("Session:", WAHA_SESSION);

  await checkWahaStatus();

  // Check status every 10 seconds
  setInterval(async () => {
    await checkWahaStatus();
  }, 10000);
}

// Webhook endpoint to receive messages from Waha
app.post("/webhook/waha", async (req, res) => {
  try {
    const event = req.body;
    console.log("📩 Waha webhook received - FULL DATA:", JSON.stringify(event, null, 2));

    // Only process message events
    if (event.event !== "message" && event.event !== "message.any") {
      return res.json({ success: true });
    }

    const message = event.payload;

    // Only process messages from business owner (fromMe: true)
    if (!message.fromMe) {
      console.log("⏭️ Skipping message (not from business owner)");
      return res.json({ success: true });
    }

    if (!businessWhatsAppNumber) {
      return res.json({ success: true });
    }

    const chatId = `${businessWhatsAppNumber}@c.us`;
    if (message.from !== chatId) {
      return res.json({ success: true });
    }

    // Skip if this is our own inquiry message
    if (message.id && inquiriesByMsgId.has(message.id)) {
      return res.json({ success: true });
    }

    if (
      message.body.startsWith("🔔 *New Website Inquiry*") ||
      message.body.startsWith("💡 To reply to a customer")
    ) {
      return res.json({ success: true });
    }

    let targetSessionId = null;

    // Check if message is a reply (quoted message) - Waha format
    if (message.replyTo && message.replyTo.id) {
      const quotedId = message.replyTo.id;
      const inquiry = inquiriesByMsgId.get(quotedId);
      if (inquiry) {
        targetSessionId = inquiry.sessionId;
        console.log(`📨 Owner reply via quote to session: ${targetSessionId}`);
      }
    }
    // Also check whatsapp-web.js format for backward compatibility
    else if (message._data && message._data.quotedMsg) {
      const quotedId = message._data.quotedMsg.id;
      const inquiry = inquiriesByMsgId.get(quotedId);
      if (inquiry) {
        targetSessionId = inquiry.sessionId;
        console.log(`📨 Owner reply via quote to session: ${targetSessionId}`);
      }
    }

    // Check for session tag in message
    if (!targetSessionId) {
      const tagMatch = message.body.match(/(?:\[#|#)([A-Z0-9]{4})\]?/);
      if (tagMatch) {
        const tag = tagMatch[1];
        for (const [sid, t] of sessionTags.entries()) {
          if (t === tag) {
            targetSessionId = sid;
            console.log(
              `📨 Owner reply via tag #${tag} to session: ${targetSessionId}`,
            );
            break;
          }
        }
      }
    }

    if (targetSessionId) {
      const replyMessage = {
        type: "reply",
        message: message.body,
        timestamp: Math.floor(Date.now() / 1000),
      };

      updateSessionActivity(targetSessionId);

      if (sseClients.has(targetSessionId)) {
        const clients = sseClients.get(targetSessionId);
        clients.forEach((client) => {
          client.write(`data: ${JSON.stringify(replyMessage)}\n\n`);
        });
        console.log(
          `✅ Reply delivered to session: ${targetSessionId} (${clients.size} client(s))`,
        );
      } else {
        if (!pendingBySession.has(targetSessionId)) {
          pendingBySession.set(targetSessionId, []);
        }
        pendingBySession.get(targetSessionId).push(replyMessage);
        console.log(`📥 Reply queued for session: ${targetSessionId}`);
      }
    } else {
      const hintMsg =
        "💡 To reply to a customer, either:\n• Quote their message, or\n• Include the session tag like #TAG in your reply";
      await sendWahaMessage(chatId, hintMsg);
      console.log("⚠️ Owner reply without valid session - sent hint");
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/events", (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId).add(res);
  updateSessionActivity(sessionId);
  console.log(
    `📡 SSE client connected: ${sessionId} (total: ${sseClients.get(sessionId).size})`,
  );

  if (pendingBySession.has(sessionId)) {
    const pending = pendingBySession.get(sessionId);
    pending.forEach((msg) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    });
    pendingBySession.delete(sessionId);
  }

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    if (sseClients.has(sessionId)) {
      sseClients.get(sessionId).delete(res);
      const remaining = sseClients.get(sessionId).size;
      console.log(
        `📡 SSE client disconnected: ${sessionId} (remaining: ${remaining})`,
      );
      if (remaining === 0) {
        sseClients.delete(sessionId);
      }
    }
  });
});

// Poll for replies endpoint (for mobile app compatibility)
app.get("/api/poll-replies", (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  updateSessionActivity(sessionId);

  if (pendingBySession.has(sessionId)) {
    const replies = pendingBySession.get(sessionId);
    pendingBySession.delete(sessionId);
    console.log(
      `📬 Delivered ${replies.length} queued reply(ies) to session: ${sessionId}`,
    );
    return res.json({ replies });
  }

  res.json({ replies: [] });
});

// Send message endpoint - sends customer inquiries TO the business owner
app.post("/api/send-message", sendMessageRateLimit, async (req, res) => {
  try {
    const { customerName, message, customerEmail, sessionId } = req.body;
    console.log("📤 Received customer inquiry:", {
      customerName,
      message,
      customerEmail,
      sessionId,
    });

    if (!message) {
      console.log("❌ Missing message");
      return res.status(400).json({ error: "Message is required" });
    }

    if (!sessionId) {
      console.log("❌ Missing sessionId");
      return res.status(400).json({ error: "sessionId is required" });
    }

    if (!isClientReady) {
      console.log("❌ WhatsApp client not ready");
      return res.status(503).json({
        error: "WhatsApp client not ready",
        qrCode: qrCodeData
          ? "Please scan QR code first"
          : "Client is initializing",
      });
    }

    if (!businessWhatsAppNumber) {
      console.log("❌ Business WhatsApp number not available");
      return res.status(503).json({
        error: "Business WhatsApp number not configured",
      });
    }

    const chatId = `${businessWhatsAppNumber}@c.us`;
    const sessionTag = getTagForSession(sessionId);

    const formattedMessage =
      `🔔 *New Website Inquiry* [#${sessionTag}]\n\n` +
      `👤 From: ${customerName || "Anonymous"}\n` +
      `${customerEmail ? `📱 Phone: ${customerEmail}\n` : ""}` +
      `\n💬 Message:\n${message}\n\n` +
      `⏰ ${new Date().toLocaleString()}`;

    console.log("📱 Sending to business WhatsApp:", chatId);

    const sentMessage = await sendWahaMessage(chatId, formattedMessage);
    console.log("✅ Message sent successfully:", sentMessage.id);

    updateSessionActivity(sessionId);

    inquiriesByMsgId.set(sentMessage.id, {
      sessionId,
      customerName,
      customerEmail,
      createdAt: Date.now(),
      tag: sessionTag,
    });

    res.json({
      success: true,
      data: {
        id: sentMessage.id,
        timestamp: sentMessage.timestamp || Math.floor(Date.now() / 1000),
        sessionTag,
      },
    });
  } catch (error) {
    console.error("❌ Error sending message:", error.message);
    console.error("Full error:", error);
    res.status(500).json({
      error: "Failed to send message",
      details: error.message,
    });
  }
});

// Get QR code endpoint (for authentication) - localhost only
app.get("/api/qr-code", localhostOnly, (req, res) => {
  if (isClientReady) {
    res.json({
      ready: true,
      message: "WhatsApp client is ready",
    });
  } else if (qrCodeData) {
    res.json({
      ready: false,
      qrCode: qrCodeData,
      message: "Scan QR code with WhatsApp",
    });
  } else {
    res.json({
      ready: false,
      message: "Initializing...",
    });
  }
});

// Get session status endpoint - localhost only
app.get("/api/sessions", localhostOnly, async (req, res) => {
  try {
    await checkWahaStatus();

    const sessionInfo = {
      status: isClientReady ? "ready" : "not_ready",
      authenticated: isClientReady,
      needsQR: !isClientReady && qrCodeData !== null,
    };

    if (isClientReady && businessWhatsAppNumber) {
      sessionInfo.info = {
        phone: businessWhatsAppNumber,
      };
    }

    res.json(sessionInfo);
  } catch (error) {
    console.error("Error fetching session info:", error.message);
    res.status(500).json({ error: "Failed to fetch session info" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    whatsappReady: isClientReady,
    service: "waha",
  });
});

// Logout/disconnect endpoint - localhost only
app.post("/api/logout", localhostOnly, async (req, res) => {
  try {
    await wahaRequest(`/api/sessions/${WAHA_SESSION}/logout`, {
      method: "POST",
    });
    isClientReady = false;
    qrCodeData = null;
    businessWhatsAppNumber = null;
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Error logging out:", error.message);
    res.status(500).json({ error: "Failed to logout" });
  }
});

// Initialize Waha
initializeWaha();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`WhatsApp service: Waha`);
  console.log(`Waha URL: ${WAHA_BASE_URL}`);
  console.log(`CORS: Open (all origins allowed)`);
  console.log(
    `\n⚠️  IMPORTANT: Configure Waha webhook to: http://YOUR_REPLIT_URL:${PORT}/webhook/waha`,
  );
});
