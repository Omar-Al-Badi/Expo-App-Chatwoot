const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 5000;

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(__dirname));

const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'Too many messages sent. Please wait a minute before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Webhook endpoint - forwards to backend
app.post('/webhook/waha', async (req, res) => {
  try {
    console.log('📩 Webhook received on port 5000, forwarding to backend...');
    const response = await fetch('http://localhost:3001/webhook/waha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Webhook proxy error:', error);
    res.status(500).json({ error: 'Failed to forward webhook to backend' });
  }
});

// Poll for replies endpoint - forwards to backend
app.get('/api/poll-replies', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    const response = await fetch(`http://localhost:3001/api/poll-replies?sessionId=${sessionId}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Polling proxy error:', error);
    res.status(500).json({ error: 'Failed to poll for replies' });
  }
});

app.post('/api/send-message', messageLimiter, async (req, res) => {
  const { customerName, message, customerEmail } = req.body;
  
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message too long. Maximum 1000 characters.' });
  }
  
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  try {
    const response = await fetch('http://localhost:3001/api/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to forward request to backend' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web frontend running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
});
