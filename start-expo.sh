#!/bin/bash

# Universal domain detection - works on Replit, local, or any hosting platform
# Priority: CUSTOM_DOMAIN > REPLIT_DEV_DOMAIN > localhost

if [ -n "$CUSTOM_DOMAIN" ]; then
  # User-defined custom domain (highest priority)
  DOMAIN="$CUSTOM_DOMAIN"
  PROTOCOL="https"
  echo "🎯 Using custom domain: $DOMAIN"
elif [ -n "$REPLIT_DEV_DOMAIN" ]; then
  # Replit environment
  DOMAIN="$REPLIT_DEV_DOMAIN"
  PROTOCOL="https"
  echo "🔵 Detected Replit environment"
else
  # Local development or other platforms
  # Get the local IP address for LAN access
  if command -v hostname &> /dev/null; then
    DOMAIN=$(hostname -I | awk '{print $1}')
  fi
  
  # Fallback to localhost if hostname command fails
  if [ -z "$DOMAIN" ]; then
    DOMAIN="localhost"
  fi
  
  PROTOCOL="http"
  echo "💻 Using local development mode"
fi

# Set environment variables
export REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN"
export EXPO_DEVTOOLS_LISTEN_ADDRESS="0.0.0.0"
export EXPO_PUBLIC_BACKEND_URL="${PROTOCOL}://${DOMAIN}:3001"

echo "🌐 Domain: $DOMAIN"
echo "📱 Backend URL: $EXPO_PUBLIC_BACKEND_URL"
echo "🔌 Protocol: $PROTOCOL"

# Start the backend server in the background
node server.js &

# Start Expo
npx expo start --port 8080
