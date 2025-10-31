const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3001;

// Chatwoot configuration
const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL || "";
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN || "";
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || "";
const CHATWOOT_INBOX_ID = process.env.CHATWOOT_INBOX_ID || "";

let isClientReady = true;

const conversationBySession = new Map();
const contactBySession = new Map();
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

// Format date in UAE timezone (Asia/Dubai, UTC+4)
function formatUAETime(date = new Date()) {
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// Helper function to make Chatwoot API requests
async function chatwootRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "api_access_token": CHATWOOT_API_TOKEN,
    ...options.headers,
  };

  const url = `${CHATWOOT_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chatwoot API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Helper to check if string is a valid email
function isValidEmail(str) {
  if (!str) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

// Create or get contact in Chatwoot
async function getOrCreateContact(sessionId, customerName, customerEmail) {
  try {
    // Check if we already have a contact for this session
    if (contactBySession.has(sessionId)) {
      return contactBySession.get(sessionId);
    }

    // Create a new contact
    const contactData = {
      inbox_id: CHATWOOT_INBOX_ID,
      name: customerName || "Anonymous",
      identifier: sessionId,
    };

    // Only add email or phone_number if provided, and in the correct field
    if (customerEmail) {
      if (isValidEmail(customerEmail)) {
        contactData.email = customerEmail;
      } else {
        // Assume it's a phone number
        contactData.phone_number = customerEmail;
      }
    }

    const contact = await chatwootRequest(
      `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts`,
      {
        method: "POST",
        body: JSON.stringify(contactData),
      }
    );

    contactBySession.set(sessionId, contact.payload.contact);
    return contact.payload.contact;
  } catch (error) {
    console.error("Error creating contact:", error.message);
    throw error;
  }
}

// Create conversation in Chatwoot
async function createConversation(sessionId, contactId) {
  try {
    // Check if we already have a conversation for this session
    if (conversationBySession.has(sessionId)) {
      return conversationBySession.get(sessionId);
    }

    const conversationData = {
      source_id: sessionId,
      inbox_id: CHATWOOT_INBOX_ID,
      contact_id: contactId,
      status: "open",
    };

    const conversation = await chatwootRequest(
      `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations`,
      {
        method: "POST",
        body: JSON.stringify(conversationData),
      }
    );

    conversationBySession.set(sessionId, conversation);
    return conversation;
  } catch (error) {
    console.error("Error creating conversation:", error.message);
    throw error;
  }
}

// Send message to Chatwoot conversation
async function sendChatwootMessage(conversationId, message) {
  try {
    const messageData = {
      content: message,
      message_type: "incoming",
      private: false,
    };

    return await chatwootRequest(
      `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(messageData),
      }
    );
  } catch (error) {
    console.error("Error sending message:", error.message);
    throw error;
  }
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [sessionId, lastActivity] of sessionActivity.entries()) {
    if (now - lastActivity > SESSION_TTL) {
      sessionTags.delete(sessionId);
      pendingBySession.delete(sessionId);
      sessionActivity.delete(sessionId);
      sseClients.delete(sessionId);
      conversationBySession.delete(sessionId);
      contactBySession.delete(sessionId);
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

// Webhook endpoint to receive messages from Chatwoot
app.post("/webhook/chatwoot", async (req, res) => {
  try {
    const event = req.body;
    console.log(
      "📩 Chatwoot webhook received:",
      JSON.stringify(event, null, 2),
    );

    // Only process message_created events
    if (event.event !== "message_created") {
      return res.json({ success: true });
    }

    const message = event.message;
    const conversation = event.conversation;

    // Only process outgoing messages (from agent)
    if (message.message_type !== "outgoing") {
      console.log("⏭️ Skipping incoming message");
      return res.json({ success: true });
    }

    // Skip private/internal messages
    if (message.private) {
      console.log("⏭️ Skipping private message");
      return res.json({ success: true });
    }

    // Find the session ID from the conversation source_id
    const sessionId = conversation.meta?.sender?.identifier || conversation.additional_attributes?.source_id;
    
    if (!sessionId) {
      console.log("⚠️ No session ID found in conversation");
      return res.json({ success: true });
    }

    console.log(`📨 Agent reply to session: ${sessionId}`);

    const replyMessage = {
      type: "reply",
      message: message.content,
      timestamp: Math.floor(Date.now() / 1000),
    };

    updateSessionActivity(sessionId);

    // Deliver message via SSE or queue it
    if (sseClients.has(sessionId)) {
      const clients = sseClients.get(sessionId);
      clients.forEach((client) => {
        client.write(`data: ${JSON.stringify(replyMessage)}\n\n`);
      });
      console.log(
        `✅ Reply delivered to session: ${sessionId} (${clients.size} client(s))`,
      );
    } else {
      if (!pendingBySession.has(sessionId)) {
        pendingBySession.set(sessionId, []);
      }
      pendingBySession.get(sessionId).push(replyMessage);
      console.log(`📥 Reply queued for session: ${sessionId}`);
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

// Send message endpoint - sends customer inquiries to Chatwoot
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

    const sessionTag = getTagForSession(sessionId);

    // Create or get contact
    const contact = await getOrCreateContact(sessionId, customerName, customerEmail);
    console.log("✅ Contact ready:", contact.id);

    // Create or get conversation
    const conversation = await createConversation(sessionId, contact.id);
    console.log("✅ Conversation ready:", conversation.id);

    // Format the message with customer info
    const formattedMessage =
      `👤 From: ${customerName || "Anonymous"}\n` +
      `${customerEmail ? `📱 Contact: ${customerEmail}\n` : ""}` +
      `\n💬 Message:\n${message}\n\n` +
      `⏰ ${formatUAETime()}\n` +
      `🔖 Session: #${sessionTag}`;

    // Send message to Chatwoot
    const sentMessage = await sendChatwootMessage(conversation.id, formattedMessage);
    console.log("✅ Message sent to Chatwoot:", sentMessage.id);

    updateSessionActivity(sessionId);

    res.json({
      success: true,
      data: {
        id: sentMessage.id,
        timestamp: Math.floor(Date.now() / 1000),
        sessionTag,
        conversationId: conversation.id,
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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    chatwootReady: isClientReady,
    service: "chatwoot",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Chat service: Chatwoot`);
  console.log(`Chatwoot URL: ${CHATWOOT_BASE_URL}`);
  console.log(`Account ID: ${CHATWOOT_ACCOUNT_ID}`);
  console.log(`Inbox ID: ${CHATWOOT_INBOX_ID}`);
  console.log(`CORS: Open (all origins allowed)`);
  console.log(
    `\n⚠️  IMPORTANT: Configure Chatwoot webhook to: https://YOUR_REPLIT_URL/webhook/chatwoot`,
  );
});
