const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8000;
const BACKEND_URL = 'http://localhost:3001';

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mobile API Server' });
});

// Proxy send-message to backend
app.post('/api/send-message', async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/send-message`, {
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

// Proxy poll-replies to backend
app.get('/api/poll-replies', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    const response = await fetch(`${BACKEND_URL}/api/poll-replies?sessionId=${sessionId}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Polling proxy error:', error);
    res.status(500).json({ error: 'Failed to poll for replies' });
  }
});

// Webhook relay - forward Waha webhooks to backend
app.post('/webhook/waha', async (req, res) => {
  try {
    console.log('📩 Webhook received on port 8000, forwarding to backend...');
    const response = await fetch(`${BACKEND_URL}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Webhook relay error:', error);
    res.status(500).json({ error: 'Failed to forward webhook' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mobile API Server running on port ${PORT}`);
  console.log(`📱 External URL: https://${process.env.REPLIT_DEV_DOMAIN}:${PORT}`);
});
