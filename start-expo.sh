#!/bin/bash

# Dynamically set the Replit domain for Expo
export REACT_NATIVE_PACKAGER_HOSTNAME="${REPLIT_DEV_DOMAIN}"
export EXPO_DEVTOOLS_LISTEN_ADDRESS="0.0.0.0"
export EXPO_PUBLIC_BACKEND_URL="https://${REPLIT_DEV_DOMAIN}:3001"

echo "🌐 Using domain: ${REPLIT_DEV_DOMAIN}"
echo "📱 Backend URL: ${EXPO_PUBLIC_BACKEND_URL}"

# Start the backend server in the background
node server.js &

# Start Expo
npx expo start --port 8080
