# Overview

This is a Chatwoot-integrated chat widget for websites and mobile apps that enables **two-way communication** between customers and business owners. The system includes:
- A web frontend (port 5000) with an embedded chat widget and webhook relay - **FULLY WORKING**
- A React Native mobile app (Expo) for customer inquiries - **FULLY WORKING**
- A Node.js backend (port 3001) integrated with self-hosted Chatwoot instance
- **Two-way messaging**: Customers send inquiries via web/mobile → Business receives in Chatwoot dashboard → Business replies in Chatwoot → Customer sees reply in real-time
- Session-based conversation tracking with unique session tags
- Real-time message delivery using polling for mobile and SSE for web
- Webhook-based reply routing through web server reverse proxy
- Automatic contact and conversation creation in Chatwoot

**System Status**: All components operational. Web frontend serving on port 5000, mobile app built with iOS keyboard handling optimized.

# Recent Changes

## October 31, 2025 - Chatwoot Integration (Replaced WhatsApp)
- **Replaced WhatsApp with Chatwoot**: Complete migration from Waha/WhatsApp to self-hosted Chatwoot
  - Customer inquiries now create contacts and conversations in Chatwoot dashboard
  - Agent replies in Chatwoot are delivered back to customers in real-time
  - Webhook URL: `https://[replit-url]/webhook/chatwoot`
  - Uses Chatwoot Application API with token-based authentication
- **UAE timezone implementation**: All customer inquiry timestamps use Asia/Dubai timezone (UTC+4) with 12-hour format
- **Session tracking**: Unique 4-character session tags (#ABCD) for easy conversation identification
- **Contact management**: Automatic contact creation with customer name, email/phone, and session identifier
- **Result**: All customer conversations now managed in Chatwoot dashboard with full conversation history and agent capabilities

## October 26, 2025 - iOS Keyboard Handling with react-native-keyboard-controller
- **Installed react-native-keyboard-controller**: Modern library specifically designed for chat app keyboard handling
- **KeyboardProvider wrapper**: App wrapped in KeyboardProvider in _layout.tsx for global keyboard management
- **KeyboardAvoidingView with position behavior**: Uses behavior="position" to translate chat window upward when keyboard appears
- **KeyboardAwareScrollView**: Messages container uses keyboard-aware scrolling from the library
- **Tuned offset**: Set keyboardVerticalOffset to 160 to balance header visibility and input accessibility
- **Responsive height**: Chat window maxHeight set to 60% of screen for better keyboard accommodation
- **Result**: Chat window slides upward smoothly when keyboard appears on iOS, keeping input above keyboard while maintaining header visibility

## October 29, 2025 - Reverse Proxy Architecture (Legacy - Pre-Chatwoot)
- **Implemented reverse proxy**: Web server (port 5000) proxies all API and webhook requests to backend (port 3001)
- **Webhook delivery**: Webhooks delivered to web server (port 5000) which forwards to backend for HTTPS compatibility
- **Removed email validation**: Phone numbers now accepted in contact field
- **Note**: This architecture is still in use with Chatwoot integration (webhook endpoint updated to /webhook/chatwoot)

## October 23, 2025 - Legacy System (Pre-Chatwoot Migration)
- **Note**: This section describes the previous WhatsApp/Waha system which has been replaced with Chatwoot

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

**Problem**: Need two-way communication between website customers and business support team.

**Solution**: Express.js server (v5.1.0) running on port 3001, integrated with self-hosted Chatwoot instance.

**Message Flow Design**:
- Customer enters optional name/phone number and types a message on the website or mobile app
- Backend creates or retrieves a contact in Chatwoot with customer details
- Each message creates/updates a conversation in Chatwoot with unique session identifier
- Messages are formatted with customer info, message content, timestamp, and unique session tag (e.g., #AB12)
- Business agents reply in Chatwoot dashboard
- Chatwoot sends webhook to web server (port 5000) which proxies to backend (port 3001)
- Backend detects agent's reply and routes it back to the correct customer via SSE (web) or polling (mobile)

**Key Architectural Decisions**:

- **Chatwoot integration**: Uses self-hosted Chatwoot instance via Application API
- **Authentication**: Token-based authentication (stored in Replit Secrets as CHATWOOT_API_TOKEN)
- **Contact management**: Automatic contact creation with name, email/phone, and session identifier
- **Conversation management**: Each session creates a unique conversation with source_id for tracking
- **Session tracking**: Each customer gets a unique sessionId (stored in AsyncStorage/localStorage) and a 4-character tag for easy reference
- **Webhook routing**: Web server (port 5000) receives Chatwoot webhooks and proxies to backend (port 3001)
  - **Reverse proxy architecture**: Port 5000 is the only externally accessible port on Replit
  - Webhook URL: `https://[replit-url]/webhook/chatwoot` (no port specification needed)
- **Event handling**: Processes `message_created` events with `message_type: outgoing` (agent replies)
- **Message routing**: Uses conversation metadata (source_id/identifier) to match replies to customer sessions
- **Real-time delivery**: 
  - **Web**: Server-Sent Events (SSE) for instant delivery
  - **Mobile**: 3-second polling to fetch queued replies
- **Offline queuing**: Replies are queued when customer is offline and delivered on next poll/SSE connection
- **Session lifecycle**: 7-day TTL based on last activity (send, reply, or SSE connect); automatic cleanup of expired sessions
- **Message formatting**: Structured format with customer name, contact info (optional), message, timestamp, and session tag
- **CORS enabled**: Allows cross-origin requests for frontend-backend communication

**Rationale**: Chatwoot provides a full-featured customer support dashboard with conversation history, agent assignments, and team collaboration. The API-based integration allows seamless two-way communication while maintaining all benefits of a professional support platform. The reverse proxy architecture solves Replit's HTTPS requirements and port accessibility constraints.

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
- Starts Backend Server (port 3001) for Chatwoot integration
- Starts Expo development server for mobile app testing
- Automatic domain detection (Replit, VPS, or local)
- Run with: `bash start-expo.sh`

**Web Frontend**: Serves web landing page and reverse proxy:
- Web server (port 5000) with embedded chat widget
- Proxies API requests to backend (port 3001)
- Receives and forwards Chatwoot webhooks
- Run with: `cd web && node server.js`

# External Dependencies

## Backend & APIs
- **Express**: Web server framework
  - Port 3001: Chatwoot backend API
  - Port 5000: Web frontend with reverse proxy to backend
- **Axios**: HTTP client for API communication
- **cors**: Cross-origin resource sharing middleware
- **body-parser**: Request body parsing

## Webhook Infrastructure
- **Web Server** (port 5000): Receives Chatwoot webhooks and proxies to backend
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