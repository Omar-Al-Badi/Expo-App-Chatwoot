#!/bin/bash

# Universal domain detection - works on Replit, VPS, local, or any hosting platform
# Priority: CUSTOM_DOMAIN > REPLIT_DEV_DOMAIN > PUBLIC_IP > LOCAL_IP > localhost

IS_REPLIT=false

if [ -n "$CUSTOM_DOMAIN" ]; then
  # User-defined custom domain (highest priority)
  DOMAIN="$CUSTOM_DOMAIN"
  PROTOCOL="https"
  echo "🎯 Using custom domain: $DOMAIN"
elif [ -n "$REPLIT_DEV_DOMAIN" ]; then
  # Replit environment
  DOMAIN="$REPLIT_DEV_DOMAIN"
  PROTOCOL="https"
  IS_REPLIT=true
  echo "🔵 Detected Replit environment"
else
  # Try to get public IP (for VPS/cloud servers)
  echo "🔍 Detecting public IP..."
  PUBLIC_IP=""
  
  # Try multiple services for reliability
  PUBLIC_IP=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null)
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -s --connect-timeout 3 api.ipify.org 2>/dev/null)
  fi
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -s --connect-timeout 3 icanhazip.com 2>/dev/null)
  fi
  
  # Validate that we got a valid IP address (basic check)
  if [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    DOMAIN="$PUBLIC_IP"
    PROTOCOL="http"
    echo "🌍 Using public IP: $DOMAIN (VPS/Cloud server detected)"
  else
    # Fallback to local IP for LAN development
    if command -v hostname &> /dev/null; then
      DOMAIN=$(hostname -I | awk '{print $1}')
    fi
    
    # Final fallback to localhost
    if [ -z "$DOMAIN" ]; then
      DOMAIN="localhost"
    fi
    
    PROTOCOL="http"
    echo "💻 Using local development mode: $DOMAIN"
  fi
fi

# Set backend URL - Replit uses reverse proxy on port 5000, others access port 3001 directly
if [ "$IS_REPLIT" = true ]; then
  # On Replit, the web server (port 5000) proxies API requests to backend (port 3001)
  export EXPO_PUBLIC_BACKEND_URL="${PROTOCOL}://${DOMAIN}"
  echo "📡 Using Replit reverse proxy (port 5000 → 3001)"
else
  # On VPS/local, access backend port 3001 directly
  export EXPO_PUBLIC_BACKEND_URL="${PROTOCOL}://${DOMAIN}:3001"
fi

# Set environment variables
export REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN"
export EXPO_DEVTOOLS_LISTEN_ADDRESS="0.0.0.0"

echo "🌐 Domain: $DOMAIN"
echo "📱 Backend URL: $EXPO_PUBLIC_BACKEND_URL"
echo "🔌 Protocol: $PROTOCOL"

# Start the backend server in the background
node server.js &

# Start Expo
npx expo start --port 8080
