# Overview

This is a WhatsApp-integrated chat widget for websites that enables customers to send inquiries directly to a business owner's WhatsApp account. The system includes:
- A web frontend (port 5000) with an embedded chat widget
- A Node.js backend (port 3001) running whatsapp-web.js for WhatsApp integration
- Customer messages are sent TO the authenticated business WhatsApp (96894515755), not from the business to customers
- Session persistence using LocalAuth strategy for seamless re-authentication

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
- **Backend communication**: Proxy API endpoint (/api/send-message) forwards requests to backend on port 3001
- **Responsive design**: Mobile-first approach with fluid layouts
- **Visual feedback**: Success/error messages displayed in chat after sending

**Rationale**: A simple, clean web interface ensures compatibility across all devices and browsers. The floating widget pattern is familiar to users from other chat systems.

## Backend Architecture

**Problem**: Need to send customer website inquiries directly to business owner's WhatsApp account.

**Solution**: Express.js server (v5.1.0) running on port 3001 with WhatsApp Web.js client.

**Message Flow Design**:
- Customer enters optional name/email and types a message on the website
- Backend captures the authenticated business WhatsApp number on client ready
- Messages are sent TO the business WhatsApp (not to customer phone numbers)
- Each message is formatted with customer info, message content, and timestamp

**Key Architectural Decisions**:

- **WhatsApp client**: Uses `whatsapp-web.js` (v1.34.1) with Puppeteer for browser automation
- **Session persistence**: LocalAuth strategy with clientId 'whatsapp-session' to maintain WhatsApp sessions
- **Business number capture**: Automatically retrieves authenticated user's WhatsApp number from client.info.wid.user
- **Message formatting**: Structured format with customer name, email (optional), message, and timestamp
- **Headless browser**: Chromium with optimized flags for containerized/Replit environments
- **Dynamic executable path**: Auto-detects Chromium installation or uses Puppeteer's bundled version
- **CORS enabled**: Allows cross-origin requests for frontend-backend communication
- **QR code generation**: Uses `qrcode-terminal` for WhatsApp authentication display

**Rationale**: This design allows website visitors to contact the business without needing WhatsApp themselves. The business owner receives all inquiries in their WhatsApp account and can respond directly.

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