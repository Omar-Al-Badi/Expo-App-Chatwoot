# Overview

This is a WhatsApp-integrated chat widget for websites and mobile apps that enables **two-way communication** between customers and business owners. The system includes:
- A web frontend (port 5000) with an embedded chat widget and webhook relay - **FULLY WORKING**
- A React Native mobile app (Expo) for customer inquiries - **FULLY WORKING**
- A Node.js backend (port 3001) integrated with external Waha (WhatsApp HTTP API) instance at http://116.203.63.227:3000
- **Two-way messaging**: Customers send inquiries via web/mobile → Business receives on WhatsApp → Business replies in WhatsApp → Customer sees reply in real-time
- Session-based conversation tracking with unique session tags
- Real-time message delivery using polling for mobile
- Webhook-based reply routing through web server reverse proxy
- Business WhatsApp: 96877587737

**System Status**: All components operational. Web frontend serving on port 5000, mobile app built with iOS keyboard handling optimized.

# Recent Changes

## October 31, 2025 - UAE Timezone & Chatwoot Integration
- **UAE timezone implementation**: All customer inquiry timestamps now use Asia/Dubai timezone (UTC+4) with 12-hour format
- **Chatwoot reference cleanup**: Automated removal of Chatwoot ticket metadata from business replies
  - Removes patterns: "Ticket ID: 12345", "[Ticket #12345]", "Ref: #12345", status messages
  - Removes session tags: "#J9ZC", "[#J9ZC]" (customers don't see internal routing tags)
  - Preserves multi-line formatting and intentional blank lines
  - Handles both Unix (LF) and Windows (CRLF) line endings
- **Debug logging**: Added detailed debugging for quote/tag matching to troubleshoot reply routing issues
- **Result**: Customers see clean timestamps in local UAE time, and replies appear natural without system reference numbers or session tags

## October 26, 2025 - iOS Keyboard Handling with react-native-keyboard-controller
- **Installed react-native-keyboard-controller**: Modern library specifically designed for chat app keyboard handling
- **KeyboardProvider wrapper**: App wrapped in KeyboardProvider in _layout.tsx for global keyboard management
- **KeyboardAvoidingView with position behavior**: Uses behavior="position" to translate chat window upward when keyboard appears
- **KeyboardAwareScrollView**: Messages container uses keyboard-aware scrolling from the library
- **Tuned offset**: Set keyboardVerticalOffset to 160 to balance header visibility and input accessibility
- **Responsive height**: Chat window maxHeight set to 60% of screen for better keyboard accommodation
- **Result**: Chat window slides upward smoothly when keyboard appears on iOS, keeping input above keyboard while maintaining header visibility

## October 29, 2025 - Reverse Proxy Architecture
- **Implemented reverse proxy**: Web server (port 5000) now proxies all API and webhook requests to backend (port 3001)
- **Fixed webhook delivery**: Waha webhooks delivered to web server (port 5000) which forwards to backend for HTTPS compatibility
- **Removed email validation**: Phone numbers now accepted in contact field
- **Working reply routing**: Both quoted replies and manual tag replies (#TAG) successfully match and deliver to customers
- **Tested end-to-end**: Confirmed complete flow: Mobile app → WhatsApp → Reply → Mobile app receives reply via polling

## October 23, 2025 - Webhook System Fixes
- **Fixed message ID matching**: Updated reply matching logic to handle Waha's short message IDs using `endsWith()` comparison
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
- Waha sends webhook to web server (port 5000) which proxies to backend (port 3001)
- Backend detects owner's reply and routes it back to the correct customer via polling (mobile)

**Key Architectural Decisions**:

- **WhatsApp integration**: Uses external Waha (WhatsApp HTTP API) instance at http://116.203.63.227:3000
- **Authentication**: API key-based authentication (stored in Replit Secrets as WAHA_API_KEY)
- **Session management**: Uses "default" session on Waha instance with WORKING status
- **Business number capture**: Automatically retrieves WhatsApp number (96877587737) from Waha session info on startup
- **Session tracking**: Each customer gets a unique sessionId (stored in AsyncStorage) and a 4-character tag for easy reference
- **Webhook routing**: Web server (port 5000) receives Waha webhooks and proxies to backend (port 3001)
  - **Reverse proxy architecture**: Port 5000 is the only externally accessible port on Replit
  - Webhook URL: `https://[replit-url]/webhook/waha` (no port specification needed)
- **Message ID matching**: 
  - **Fixed for Waha format**: Waha webhooks use short IDs (e.g., `3EB0BD91...`) in `replyTo.id`
  - Backend stores full IDs (e.g., `true_96894515755@c.us_3EB0BD91...`)
  - Matching logic uses `endsWith()` to find partial ID matches
- **Message routing**: Maps WhatsApp message IDs to sessions; supports routing via:
  - **Quoted messages**: Matches `message.replyTo.id` to stored message IDs (Waha format)
  - **Manual tags**: Extracts session tag from message body (#TAG or [#TAG])
- **Real-time delivery**: 
  - **Mobile**: 3-second polling to fetch queued replies
- **Offline queuing**: Replies are queued when customer is offline and delivered on next poll
- **Session lifecycle**: 7-day TTL based on last activity (send, reply, or SSE connect); automatic cleanup of expired sessions
- **Message formatting**: Structured format with customer name, phone/email (optional), message, timestamp, and session tag
- **CORS enabled**: Allows cross-origin requests for frontend-backend communication

**Rationale**: This design allows website visitors to contact the business without needing WhatsApp themselves. The business owner receives all inquiries in their WhatsApp account and can respond directly. Session tags enable easy identification of which customer to reply to. The reverse proxy architecture (Waha → Web Server → Backend) solves Replit's HTTPS requirements and port accessibility constraints.

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

## Workflows

**Start Expo App**: Starts backend server and Expo development server:
- Starts Backend Server (port 3001) for WhatsApp integration
- Starts Expo development server for mobile app testing
- Automatic domain detection (Replit, VPS, or local)
- Run with: `bash start-expo.sh`

**Web Frontend**: Serves web landing page and reverse proxy:
- Web server (port 5000) with embedded chat widget
- Proxies API requests to backend (port 3001)
- Receives and forwards Waha webhooks
- Run with: `cd web && node server.js`

# External Dependencies

## Backend & APIs
- **Express**: Web server framework
  - Port 3001: WhatsApp backend API
  - Port 5000: Web frontend with reverse proxy to backend
- **Axios**: HTTP client for Waha API communication
- **cors**: Cross-origin resource sharing middleware
- **body-parser**: Request body parsing

## Webhook Infrastructure
- **Web Server** (port 5000): Receives Waha webhooks and proxies to backend
  - Only externally accessible port on Replit (HTTPS)
  - Forwards all API requests and webhooks to backend (port 3001)
  - Serves static web frontend files
  - Solves Replit's HTTPS requirement and port accessibility constraints

## Mobile App (React Native)
- **Expo SDK**: React Native development framework
- **React Native Paper**: Material Design component library for cross-platform UI
- **AsyncStorage**: Session persistence for mobile
- **Polling mechanism**: 3-second intervals to fetch replies (SSE not supported in React Native)
- **Mobile optimizations**: Dynamic height calculation to prevent cropping, KeyboardAvoidingView for better typing experience, phone number input optimized for mobile keyboards