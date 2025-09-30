const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

const WAHA_URL = 'http://188.166.209.47:3000';
const WAHA_SESSION = 'default';

app.use(cors());
app.use(bodyParser.json());

app.post('/api/send-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;

    const response = await axios.post(`${WAHA_URL}/api/sendText`, {
      chatId: chatId,
      text: message,
      session: WAHA_SESSION
    });

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to send message', 
      details: error.response?.data || error.message 
    });
  }
});

app.post('/api/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('Received webhook:', JSON.stringify(webhookData, null, 2));

    if (webhookData.event === 'message' && !webhookData.payload?.fromMe) {
      const incomingMessage = {
        from: webhookData.payload.from,
        text: webhookData.payload.body,
        timestamp: webhookData.payload.timestamp
      };
      
      console.log('Incoming message:', incomingMessage);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const response = await axios.get(`${WAHA_URL}/api/sessions`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching sessions:', error.message);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', wahaUrl: WAHA_URL });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Connected to Waha at ${WAHA_URL}`);
});
