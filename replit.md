# Overview

This is a cross-platform mobile application built with Expo and React Native. The app features a chat widget interface and includes WhatsApp Web integration via a Node.js backend server. The project uses file-based routing through Expo Router and supports iOS, Android, and web platforms.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Problem**: Need a cross-platform mobile app with native look and feel across iOS, Android, and web.

**Solution**: Expo framework with React Native, leveraging Expo SDK 54 and React 19.

**Key Architectural Decisions**:

- **File-based routing**: Uses Expo Router (~6.0.7) for navigation with typed routes, organizing screens under `app/(tabs)/` directory structure
- **Tab navigation**: Bottom tab bar with Home and Explore screens using `@react-navigation/bottom-tabs`
- **Theming system**: Custom theme provider supporting automatic light/dark mode switching via `@react-navigation/native` themes and custom color constants
- **Component architecture**: Reusable themed components (`ThemedText`, `ThemedView`) that automatically adapt to system theme
- **Platform-specific components**: Uses conditional rendering and platform-specific implementations (e.g., `IconSymbol.ios.tsx` vs `IconSymbol.tsx`)
- **Animations**: React Native Reanimated (~4.1.0) for performant animations and gesture handling
- **UI features**: Parallax scroll views, collapsible sections, haptic feedback on iOS, blur effects

**Rationale**: Expo provides a unified development experience with built-in support for native features while maintaining code sharing across platforms. File-based routing simplifies navigation structure.

## Backend Architecture

**Problem**: Need WhatsApp Web integration for chat functionality.

**Solution**: Express.js server (v5.1.0) running on port 3001 with WhatsApp Web.js client.

**Key Architectural Decisions**:

- **WhatsApp client**: Uses `whatsapp-web.js` (v1.34.1) with Puppeteer for browser automation
- **Session persistence**: LocalAuth strategy with clientId 'whatsapp-session' to maintain WhatsApp sessions
- **Headless browser**: Chromium with optimized flags for containerized/Replit environments
- **Dynamic executable path**: Auto-detects Chromium installation or uses Puppeteer's bundled version
- **CORS enabled**: Allows cross-origin requests for frontend-backend communication
- **QR code generation**: Uses `qrcode-terminal` for WhatsApp authentication display

**Rationale**: Express provides a lightweight API layer, while whatsapp-web.js enables WhatsApp integration without official API. LocalAuth ensures users don't need to re-authenticate frequently.

## State Management

**Problem**: Managing chat state and UI interactions.

**Solution**: React hooks (useState, useEffect, useRef) for local component state.

**Approach**: 

- Local state management within ChatWidget component
- Hardcoded response system for demo chat functionality
- Message history stored in component state with unique IDs and timestamps

**Rationale**: Simple state needs don't warrant additional state management libraries. Component-level state keeps the architecture straightforward.

## Styling Approach

**Problem**: Consistent styling across platforms with theme support.

**Solution**: React Native StyleSheet API with theme-aware custom hooks.

**Implementation**:

- `useThemeColor` hook for dynamic color selection based on system theme
- `useColorScheme` hook with web-specific implementation for SSR compatibility
- Centralized color constants in `constants/Colors.ts`
- Platform-specific style adjustments using Platform.select()

**Rationale**: Native StyleSheet provides performance benefits over inline styles, while custom hooks enable theme reactivity without prop drilling.

## Asset Management

**Solution**: Expo's asset system with Image component from expo-image.

**Implementation**:

- Static assets in `assets/` directory (fonts, images)
- Custom font loading with expo-font (SpaceMono)
- Adaptive icons and splash screens configured via app.json
- Platform-specific icon formats (adaptive icons for Android)

## Development Configuration

**Build system**: Metro bundler with Expo's configuration
**Type safety**: TypeScript with strict mode enabled
**Linting**: ESLint with expo-config-expo/flat configuration
**New Architecture**: Enabled (`newArchEnabled: true`) for performance improvements

# External Dependencies

## Core Framework
- **Expo SDK 54**: Cross-platform app framework providing unified APIs for native features
- **React 19.1.0 & React Native 0.81.4**: Core UI framework and native bridge

## Navigation & Routing
- **expo-router ~6.0.7**: File-based routing system
- **@react-navigation/native 7.1.6**: Navigation primitives
- **@react-navigation/bottom-tabs 7.3.10**: Tab navigation

## Backend & APIs
- **Express 5.1.0**: Web server framework (port 3001)
- **whatsapp-web.js 1.34.1**: WhatsApp Web integration library
- **axios 1.12.2**: HTTP client for API requests
- **cors 2.8.5**: Cross-origin resource sharing middleware
- **body-parser 2.2.0**: Request body parsing

## UI & Animations
- **react-native-reanimated ~4.1.0**: High-performance animations
- **react-native-gesture-handler ~2.28.0**: Touch gesture system
- **expo-blur ~15.0.7**: Native blur effects
- **@expo/vector-icons 15.0.2**: Icon library

## Native Features
- **expo-haptics ~15.0.7**: Haptic feedback (iOS)
- **expo-web-browser ~15.0.7**: In-app browser
- **react-native-webview 13.15.0**: WebView component
- **expo-splash-screen ~31.0.10**: Splash screen management
- **expo-status-bar ~3.0.8**: Status bar customization

## Development & Tooling
- **@expo/ngrok 4.1.3**: Tunnel for development
- **qrcode-terminal 0.12.0**: QR code display for WhatsApp auth
- **TypeScript**: Type safety with strict configuration
- **ESLint 9.25.0**: Code linting

## Platform Support
- **react-native-web 0.21.0**: Web platform support
- **react-native-safe-area-context ~5.6.0**: Safe area handling
- **react-native-screens ~4.16.0**: Native screen optimization

## Browser Automation (Backend)
- **Puppeteer** (via whatsapp-web.js): Chromium automation for WhatsApp Web session
- Dynamic Chromium executable detection for Replit/container environments