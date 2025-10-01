# Overview

This is a WhatsApp-integrated chat widget for websites that enables **two-way communication** between customers and business owners. The system includes:
- A web frontend (port 5000) with an embedded chat widget
- A Node.js backend (port 3001) running whatsapp-web.js for WhatsApp integration
- **Two-way messaging**: Customers send inquiries via web widget → Business receives on WhatsApp → Business replies in WhatsApp → Customer sees reply in web widget
- Session-based conversation tracking with unique session tags
- Real-time message delivery using Server-Sent Events (SSE)
- Session persistence using LocalAuth strategy for seamless re-authentication
- Business WhatsApp: 96894515755

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Problem**: Need an embedded chat widget for websites to capture customer inquiries.

**Solution**: Simple web frontend (port 5000) with JavaScript-based chat interface.

**Key Architectural Decisions**:

- **Chat widget UI**: Floating button in bottom-right corner that opens chat window
- **Customer info collection**: Optional name and email fields before starting chat
- **Message display**: User messages (right-aligned, blue) and system messages (left-aligned, gray)
- **Session management**: Unique sessionId generated and persisted in localStorage for conversation continuity
- **Real-time updates**: Server-Sent Events (SSE) connection for receiving owner replies in real-time
- **Backend communication**: Proxy API endpoints (/api/send-message, /api/events) forward to backend on port 3001
- **Responsive design**: Mobile-first approach with fluid layouts
- **Visual feedback**: Success/error messages and incoming replies displayed in chat

**Rationale**: A simple, clean web interface ensures compatibility across all devices and browsers. The floating widget pattern is familiar to users from other chat systems. SSE provides efficient one-way server-to-client push for real-time replies.

## Backend Architecture

**Problem**: Need two-way communication between website customers and business owner's WhatsApp account.

**Solution**: Express.js server (v5.1.0) running on port 3001 with WhatsApp Web.js client.

**Message Flow Design**:
- Customer enters optional name/email and types a message on the website
- Backend captures the authenticated business WhatsApp number on client ready
- Messages are sent TO the business WhatsApp (not to customer phone numbers)
- Each message is formatted with customer info, message content, timestamp, and unique session tag (e.g., [#AB12])
- Business owner replies in WhatsApp by either quoting the customer's message or including the session tag
- Backend detects owner's reply and routes it back to the correct customer's browser via SSE

**Key Architectural Decisions**:

- **WhatsApp client**: Uses `whatsapp-web.js` (v1.34.1) with Puppeteer for browser automation
- **Session persistence**: LocalAuth strategy with clientId 'whatsapp-session' to maintain WhatsApp sessions
- **Business number capture**: Automatically retrieves authenticated user's WhatsApp number from client.info.wid.user
- **Session tracking**: Each customer gets a unique sessionId (stored in localStorage) and a 4-character tag for easy reference
- **Message routing**: Maps WhatsApp message IDs to sessions; supports routing via quoted messages or manual tags (#TAG or [#TAG])
- **Real-time delivery**: Server-Sent Events (SSE) endpoint pushes owner replies to connected browsers in real-time
- **Multi-client support**: Multiple browser tabs/devices for same customer all receive replies via broadcast
- **Offline queuing**: Replies are queued when customer is offline and delivered on reconnection
- **Session lifecycle**: 7-day TTL based on last activity (send, reply, or SSE connect); automatic cleanup of expired sessions
- **Message formatting**: Structured format with customer name, email (optional), message, timestamp, and session tag
- **Headless browser**: Chromium with optimized flags for containerized/Replit environments
- **Dynamic executable path**: Auto-detects Chromium installation or uses Puppeteer's bundled version
- **CORS enabled**: Allows cross-origin requests for frontend-backend communication
- **QR code generation**: Uses `qrcode-terminal` for WhatsApp authentication display

**Rationale**: This design allows website visitors to contact the business without needing WhatsApp themselves. The business owner receives all inquiries in their WhatsApp account and can respond directly. Session tags enable easy identification of which customer to reply to, while SSE provides instant delivery of replies back to the website.

## State Management

**Problem**: Managing chat state and customer information.

**Solution**: Vanilla JavaScript with DOM manipulation and local state variables.

**Approach**: 

- Customer name and email stored in JavaScript variables
- Message history rendered dynamically to DOM
- Chat open/closed state managed through CSS classes
- Asynchronous API calls to backend with proper error handling

**Rationale**: No framework needed for this simple chat interface. Vanilla JavaScript keeps the bundle size minimal and performance optimal.

## Development Configuration

**Build system**: Node.js with Express servers
**Type safety**: TypeScript for React Native components (legacy)
**Linting**: ESLint with expo-config-expo/flat configuration

# External Dependencies

## Backend & APIs
- **Express 5.1.0**: Web server framework
  - Port 3001: WhatsApp backend API
  - Port 5000: Web frontend with proxy to backend
- **whatsapp-web.js 1.34.1**: WhatsApp Web integration library
- **cors 2.8.5**: Cross-origin resource sharing middleware
- **body-parser 2.2.0**: Request body parsing
- **qrcode-terminal 0.12.0**: QR code display for WhatsApp authentication

## Browser Automation (Backend)
- **Puppeteer** (via whatsapp-web.js): Chromium automation for WhatsApp Web session
- Dynamic Chromium executable detection for Replit/container environments

## Legacy Dependencies (from React Native prototype)
- Expo SDK, React Native, and related packages (not actively used in current web implementation)