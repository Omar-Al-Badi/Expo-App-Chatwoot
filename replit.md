# Overview

This is a WhatsApp-integrated chat widget for websites and mobile apps that enables **two-way communication** between customers and business owners. The system includes:
- A web frontend (port 5000) with an embedded chat widget
- A React Native mobile app (Expo) for customer inquiries
- A Node.js backend (port 3001) integrated with external Waha (WhatsApp HTTP API) instance at http://178.128.116.119:3000
- A Mobile API Server (port 8000) for webhook relay and mobile app API
- **Two-way messaging**: Customers send inquiries via web/mobile → Business receives on WhatsApp → Business replies in WhatsApp → Customer sees reply in real-time
- Session-based conversation tracking with unique session tags
- Real-time message delivery using Server-Sent Events (SSE) for web and polling for mobile
- Webhook-based reply routing through port 8000
- Business WhatsApp: 96894515755

# Recent Changes (October 23, 2025)

## Webhook System Fixes
- **Fixed webhook delivery**: Routed Waha webhooks through port 8000 (Mobile API Server) instead of port 3001 to bypass Replit port accessibility constraints
- **Fixed message ID matching**: Updated reply matching logic to handle Waha's short message IDs using `endsWith()` comparison
- **Working reply routing**: Both quoted replies and manual tag replies (#TAG) now successfully match and deliver to customers
- **Tested end-to-end**: Confirmed complete flow: Mobile app → WhatsApp → Reply → Mobile app receives reply

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Problem**: Need an embedded chat widget for websites to capture customer inquiries.

**Solution**: Simple web frontend (port 5000) with JavaScript-based chat interface.

**Key Architectural Decisions**:

- **Chat widget UI**: Floating button in bottom-right corner that opens chat window with WhatsApp-inspired design
- **Customer info collection**: Optional name and phone number fields before starting chat
- **Message display**: User messages (light green bubbles) and system messages (white bubbles) on beige background
- **Session management**: Unique sessionId generated and persisted in localStorage for conversation continuity
- **Real-time updates**: Server-Sent Events (SSE) connection for receiving owner replies in real-time
- **Backend communication**: Proxy API endpoints (/api/send-message, /api/events) forward to backend on port 3001
- **Responsive design**: Mobile-first approach with fluid layouts
- **Visual feedback**: Success/error messages and incoming replies displayed in chat

**Rationale**: A simple, clean web interface ensures compatibility across all devices and browsers. The floating widget pattern is familiar to users from other chat systems. SSE provides efficient one-way server-to-client push for real-time replies.

## Backend Architecture

**Problem**: Need two-way communication between website customers and business owner's WhatsApp account.

**Solution**: Express.js server (v5.1.0) running on port 3001, integrated with external Waha (WhatsApp HTTP API) instance at http://178.128.116.119:3000.

**Message Flow Design**:
- Customer enters optional name/phone number and types a message on the website or mobile app
- Backend captures the authenticated business WhatsApp number on startup from Waha session
- Messages are sent TO the business WhatsApp (not to customer phone numbers)
- Each message is formatted with customer info, message content, timestamp, and unique session tag (e.g., [#AB12])
- Business owner replies in WhatsApp by either quoting the customer's message or including the session tag
- Waha sends webhook to Mobile API Server (port 8000) which forwards to backend (port 3001)
- Backend detects owner's reply and routes it back to the correct customer via SSE (web) or polling (mobile)

**Key Architectural Decisions**:

- **WhatsApp integration**: Uses external Waha (WhatsApp HTTP API) instance at http://178.128.116.119:3000
- **Authentication**: API key-based authentication (stored in Replit Secrets as WAHA_API_KEY)
- **Session management**: Uses "default" session on Waha instance with WORKING status
- **Business number capture**: Automatically retrieves WhatsApp number (96894515755) from Waha session info on startup
- **Session tracking**: Each customer gets a unique sessionId (stored in localStorage/AsyncStorage) and a 4-character tag for easy reference
- **Webhook routing**: Port 8000 (Mobile API Server) receives Waha webhooks and forwards to backend port 3001
  - **Critical fix**: Port 8000 is externally accessible, avoiding Replit port conflicts
  - Webhook URL: `https://[replit-url]:8000/webhook/waha`
- **Message ID matching**: 
  - **Fixed for Waha format**: Waha webhooks use short IDs (e.g., `3EB0BD91...`) in `replyTo.id`
  - Backend stores full IDs (e.g., `true_96894515755@c.us_3EB0BD91...`)
  - Matching logic uses `endsWith()` to find partial ID matches
- **Message routing**: Maps WhatsApp message IDs to sessions; supports routing via:
  - **Quoted messages**: Matches `message.replyTo.id` to stored message IDs (Waha format)
  - **Manual tags**: Extracts session tag from message body (#TAG or [#TAG])
- **Real-time delivery**: 
  - **Web**: Server-Sent Events (SSE) endpoint pushes owner replies to connected browsers
  - **Mobile**: 3-second polling to fetch queued replies
- **Multi-client support**: Multiple browser tabs/devices for same customer all receive replies via broadcast
- **Offline queuing**: Replies are queued when customer is offline and delivered on reconnection
- **Session lifecycle**: 7-day TTL based on last activity (send, reply, or SSE connect); automatic cleanup of expired sessions
- **Message formatting**: Structured format with customer name, phone/email (optional), message, timestamp, and session tag
- **CORS enabled**: Allows cross-origin requests for frontend-backend communication

**Rationale**: This design allows website visitors to contact the business without needing WhatsApp themselves. The business owner receives all inquiries in their WhatsApp account and can respond directly. Session tags enable easy identification of which customer to reply to. The three-tier architecture (Frontend → Mobile API Server → Backend) solves Replit's port accessibility constraints while enabling webhook delivery.

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
  - Port 8000: Mobile API Server (webhook relay)
- **Axios**: HTTP client for Waha API communication
- **cors 2.8.5**: Cross-origin resource sharing middleware
- **body-parser 2.2.0**: Request body parsing

## Webhook Infrastructure
- **Mobile API Server** (port 8000): Dedicated Express server for receiving Waha webhooks
  - Forwards webhooks to backend port 3001
  - Externally accessible for Waha webhook delivery
  - Solves Replit port accessibility constraints

## Mobile App (React Native)
- **Expo SDK**: React Native development framework
- **React Native Paper**: Material Design component library for cross-platform UI
- **AsyncStorage**: Session persistence for mobile
- **Polling mechanism**: 3-second intervals to fetch replies (SSE not supported in React Native)
- **Mobile optimizations**: Dynamic height calculation to prevent cropping, KeyboardAvoidingView for better typing experience, phone number input optimized for mobile keyboards