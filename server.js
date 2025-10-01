const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { execSync } = require('child_process');

const app = express();
const PORT = 3001;

let whatsappClient;
let isClientReady = false;
let qrCodeData = null;

app.use(cors());
app.use(bodyParser.json());

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
whatsappClient.on('ready', () => {
  console.log('WhatsApp client is ready!');
  isClientReady = true;
  qrCodeData = null;
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
    // Log incoming messages that are not from us
    if (!message.fromMe) {
      const incomingMessage = {
        from: message.from,
        text: message.body,
        timestamp: message.timestamp,
        type: message.type
      };
      console.log('Incoming message:', incomingMessage);
    }
  } catch (error) {
    console.error('Error processing incoming message:', error);
  }
});

// Initialize WhatsApp client
console.log('Initializing WhatsApp client...');
whatsappClient.initialize();

// Send message endpoint
app.post('/api/send-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    if (!isClientReady) {
      return res.status(503).json({ 
        error: 'WhatsApp client not ready',
        qrCode: qrCodeData ? 'Please scan QR code first' : 'Client is initializing'
      });
    }

    // Format chatId properly
    const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;

    // Send message using whatsapp-web.js
    const sentMessage = await whatsappClient.sendMessage(chatId, message);

    res.json({ 
      success: true, 
      data: {
        id: sentMessage.id._serialized,
        timestamp: sentMessage.timestamp
      }
    });
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ 
      error: 'Failed to send message', 
      details: error.message 
    });
  }
});

// Get QR code endpoint (for authentication)
app.get('/api/qr-code', (req, res) => {
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

// Get session status endpoint
app.get('/api/sessions', async (req, res) => {
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

// Logout/disconnect endpoint
app.post('/api/logout', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`WhatsApp service: whatsapp-web.js`);
});
