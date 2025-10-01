const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { execSync } = require('child_process');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3001;

let whatsappClient;
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tag = '';
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
app.set('trust proxy', true);

const localhostOnly = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
};

const sendMessageRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: { error: 'Too many messages. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }
});

// Find Chromium executable path dynamically
const getChromiumPath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  try {
    const chromiumPath = execSync('which chromium || which chromium-browser', { encoding: 'utf8' }).trim();
    return chromiumPath;
  } catch (error) {
    console.warn('Could not find Chromium in PATH, puppeteer will download its own');
    return undefined;
  }
};

// Initialize WhatsApp client with session persistence
whatsappClient = new Client({
  authStrategy: new LocalAuth({
    clientId: 'whatsapp-session'
  }),
  puppeteer: {
    headless: true,
    executablePath: getChromiumPath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// QR Code event - display in terminal and store for API
whatsappClient.on('qr', (qr) => {
  console.log('QR Code received! Scan this with WhatsApp:');
  qrcode.generate(qr, { small: true });
  qrCodeData = qr;
  isClientReady = false;
});

// Client ready event
whatsappClient.on('ready', async () => {
  console.log('WhatsApp client is ready!');
  isClientReady = true;
  qrCodeData = null;
  
  // Get the authenticated WhatsApp number (business owner's number)
  if (whatsappClient.info) {
    businessWhatsAppNumber = whatsappClient.info.wid.user;
    console.log('📱 Business WhatsApp Number:', businessWhatsAppNumber);
  }
});

// Authentication success event
whatsappClient.on('authenticated', () => {
  console.log('WhatsApp client authenticated successfully');
});

// Authentication failure event
whatsappClient.on('auth_failure', (msg) => {
  console.error('Authentication failed:', msg);
  isClientReady = false;
});

// Disconnected event
whatsappClient.on('disconnected', (reason) => {
  console.log('WhatsApp client disconnected:', reason);
  isClientReady = false;
});

// Incoming message event (replaces webhook)
whatsappClient.on('message', async (message) => {
  try {
    if (!message.fromMe) {
      const incomingMessage = {
        from: message.from,
        text: message.body,
        timestamp: message.timestamp,
        type: message.type
      };
      console.log('Incoming message:', incomingMessage);
      return;
    }

    if (!businessWhatsAppNumber) return;
    
    const chatId = `${businessWhatsAppNumber}@c.us`;
    if (message.from !== chatId) return;

    if (message.id && message.id._serialized && inquiriesByMsgId.has(message.id._serialized)) {
      return;
    }

    if (message.body.startsWith('🔔 *New Website Inquiry*') || 
        message.body.startsWith('💡 To reply to a customer')) {
      return;
    }

    let targetSessionId = null;

    if (message.hasQuotedMsg) {
      const quotedMsg = await message.getQuotedMessage();
      if (quotedMsg && quotedMsg.id && quotedMsg.id._serialized) {
        const inquiry = inquiriesByMsgId.get(quotedMsg.id._serialized);
        if (inquiry) {
          targetSessionId = inquiry.sessionId;
          console.log(`📨 Owner reply via quote to session: ${targetSessionId}`);
        }
      }
    }

    if (!targetSessionId) {
      const tagMatch = message.body.match(/(?:\[#|#)([A-Z0-9]{4})\]?/);
      if (tagMatch) {
        const tag = tagMatch[1];
        for (const [sid, t] of sessionTags.entries()) {
          if (t === tag) {
            targetSessionId = sid;
            console.log(`📨 Owner reply via tag #${tag} to session: ${targetSessionId}`);
            break;
          }
        }
      }
    }

    if (targetSessionId) {
      const replyMessage = {
        type: 'reply',
        message: message.body,
        timestamp: message.timestamp
      };

      updateSessionActivity(targetSessionId);

      if (sseClients.has(targetSessionId)) {
        const clients = sseClients.get(targetSessionId);
        clients.forEach(client => {
          client.write(`data: ${JSON.stringify(replyMessage)}\n\n`);
        });
        console.log(`✅ Reply delivered to session: ${targetSessionId} (${clients.size} client(s))`);
      } else {
        if (!pendingBySession.has(targetSessionId)) {
          pendingBySession.set(targetSessionId, []);
        }
        pendingBySession.get(targetSessionId).push(replyMessage);
        console.log(`📥 Reply queued for session: ${targetSessionId}`);
      }
    } else {
      const hintMsg = '💡 To reply to a customer, either:\n• Quote their message, or\n• Include the session tag like #TAG in your reply';
      await whatsappClient.sendMessage(chatId, hintMsg);
      console.log('⚠️ Owner reply without valid session - sent hint');
    }
  } catch (error) {
    console.error('Error processing incoming message:', error);
  }
});

// Initialize WhatsApp client
console.log('Initializing WhatsApp client...');
whatsappClient.initialize();

app.get('/api/events', (req, res) => {
  const sessionId = req.query.sessionId;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId).add(res);
  updateSessionActivity(sessionId);
  console.log(`📡 SSE client connected: ${sessionId} (total: ${sseClients.get(sessionId).size})`);

  if (pendingBySession.has(sessionId)) {
    const pending = pendingBySession.get(sessionId);
    pending.forEach(msg => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    });
    pendingBySession.delete(sessionId);
  }

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    if (sseClients.has(sessionId)) {
      sseClients.get(sessionId).delete(res);
      const remaining = sseClients.get(sessionId).size;
      console.log(`📡 SSE client disconnected: ${sessionId} (remaining: ${remaining})`);
      if (remaining === 0) {
        sseClients.delete(sessionId);
      }
    }
  });
});

// Send message endpoint - sends customer inquiries TO the business owner
app.post('/api/send-message', sendMessageRateLimit, async (req, res) => {
  try {
    const { customerName, message, customerEmail, sessionId } = req.body;
    console.log('📤 Received customer inquiry:', { customerName, message, customerEmail, sessionId });

    if (!message) {
      console.log('❌ Missing message');
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!sessionId) {
      console.log('❌ Missing sessionId');
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!isClientReady) {
      console.log('❌ WhatsApp client not ready');
      return res.status(503).json({ 
        error: 'WhatsApp client not ready',
        qrCode: qrCodeData ? 'Please scan QR code first' : 'Client is initializing'
      });
    }

    if (!businessWhatsAppNumber) {
      console.log('❌ Business WhatsApp number not available');
      return res.status(503).json({ 
        error: 'Business WhatsApp number not configured'
      });
    }

    const chatId = `${businessWhatsAppNumber}@c.us`;
    const sessionTag = getTagForSession(sessionId);
    
    const formattedMessage = `🔔 *New Website Inquiry* [#${sessionTag}]\n\n` +
      `👤 From: ${customerName || 'Anonymous'}\n` +
      `${customerEmail ? `📧 Email: ${customerEmail}\n` : ''}` +
      `\n💬 Message:\n${message}\n\n` +
      `⏰ ${new Date().toLocaleString()}`;

    console.log('📱 Sending to business WhatsApp:', chatId);

    const sentMessage = await whatsappClient.sendMessage(chatId, formattedMessage);
    console.log('✅ Message sent successfully:', sentMessage.id._serialized);

    updateSessionActivity(sessionId);

    inquiriesByMsgId.set(sentMessage.id._serialized, {
      sessionId,
      customerName,
      customerEmail,
      createdAt: Date.now(),
      tag: sessionTag
    });

    res.json({ 
      success: true, 
      data: {
        id: sentMessage.id._serialized,
        timestamp: sentMessage.timestamp,
        sessionTag
      }
    });
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ 
      error: 'Failed to send message', 
      details: error.message 
    });
  }
});

// Get QR code endpoint (for authentication) - localhost only
app.get('/api/qr-code', localhostOnly, (req, res) => {
  if (isClientReady) {
    res.json({ 
      ready: true, 
      message: 'WhatsApp client is ready' 
    });
  } else if (qrCodeData) {
    res.json({ 
      ready: false, 
      qrCode: qrCodeData,
      message: 'Scan QR code with WhatsApp'
    });
  } else {
    res.json({ 
      ready: false, 
      message: 'Initializing...' 
    });
  }
});

// Get session status endpoint - localhost only
app.get('/api/sessions', localhostOnly, async (req, res) => {
  try {
    const sessionInfo = {
      status: isClientReady ? 'ready' : 'not_ready',
      authenticated: isClientReady,
      needsQR: !isClientReady && qrCodeData !== null
    };

    if (isClientReady && whatsappClient.info) {
      sessionInfo.info = {
        pushname: whatsappClient.info.pushname,
        platform: whatsappClient.info.platform,
        phone: whatsappClient.info.wid.user
      };
    }

    res.json(sessionInfo);
  } catch (error) {
    console.error('Error fetching session info:', error.message);
    res.status(500).json({ error: 'Failed to fetch session info' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    whatsappReady: isClientReady,
    service: 'whatsapp-web.js'
  });
});

// Logout/disconnect endpoint - localhost only
app.post('/api/logout', localhostOnly, async (req, res) => {
  try {
    await whatsappClient.logout();
    isClientReady = false;
    qrCodeData = null;
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error.message);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`WhatsApp service: whatsapp-web.js`);
  console.log(`CORS: Open (all origins allowed)`);
});
