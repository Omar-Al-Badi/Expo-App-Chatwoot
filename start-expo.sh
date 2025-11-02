#!/bin/bash

# Universal domain detection - works on Replit, VPS, local, or any hosting platform
# Priority: CUSTOM_DOMAIN > REPLIT_DEV_DOMAIN > PUBLIC_IP > LOCAL_IP > localhost

IS_REPLIT=false

# Load .env if present (export variables for the script and child processes)
if [ -f ".env" ]; then
  echo "env: load .env"
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "env: export CHATWOOT_BASE_URL CHATWOOT_ACCOUNT_ID CHATWOOT_INBOX_ID CHATWOOT_API_TOKEN"
else
  echo "env: .env not found, using current shell environment"
fi

# Cleanup handler ensures the backend shuts down when the script exits
cleanup() {
  if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "\n🛑 Stopping backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

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

# Set backend URL - Replit uses reverse proxy on port 5000, others access port 3000 directly
if [ "$IS_REPLIT" = true ]; then
  # On Replit, the web server (port 5000) proxies API requests to backend (port 3000)
  export EXPO_PUBLIC_BACKEND_URL="${PROTOCOL}://${DOMAIN}"
  echo "📡 Using Replit reverse proxy (port 5000 → 3000)"
else
  # On VPS/local, access backend port 3000 directly
  export EXPO_PUBLIC_BACKEND_URL="${PROTOCOL}://${DOMAIN}:3000"
fi

# Set environment variables
export REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN"
export EXPO_DEVTOOLS_LISTEN_ADDRESS="0.0.0.0"

echo "🌐 Domain: $DOMAIN"
echo "📱 Backend URL: $EXPO_PUBLIC_BACKEND_URL"
echo "🔌 Protocol: $PROTOCOL"

# Start the backend server in the background
echo "🚀 Starting backend server..."
node server.js &
BACKEND_PID=$!

# Wait for backend health check (up to 20s)
BACKEND_HEALTH_URL="http://127.0.0.1:3000/api/health"
for attempt in {1..20}; do
  if curl -fsS "$BACKEND_HEALTH_URL" >/dev/null 2>&1; then
    echo "✅ Backend is ready"
    break
  fi

  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Backend process exited unexpectedly"
    wait "$BACKEND_PID" 2>/dev/null || true
    exit 1
  fi

  sleep 1
done

if ! curl -fsS "$BACKEND_HEALTH_URL" >/dev/null 2>&1; then
  echo "⚠️ Backend health check failed after waiting. Continuing, but requests may fail."
fi

# Start Expo (foreground)
echo "🚀 Starting Expo dev server... (Ctrl+C to stop)"
# Prefer non-interactive mode to avoid login prompts. If EXPO_TOKEN is set
# in the environment or in the project's .env file (which this script loads),
# the Expo CLI will use it and will not ask you to login.
export EXPO_NO_TELEMETRY=1

# -- EAS (Expo Application Services) login check
# If the `eas` CLI is available, ensure the user is logged in before continuing.
# If `eas` is missing, prompt the user to install or allow them to abort.
if command -v eas >/dev/null 2>&1; then
  # `eas whoami` returns non-zero when not logged in
  if ! eas whoami >/dev/null 2>&1; then
    echo "⚠️  You are not logged into EAS (Expo Application Services)."
    read -r -p "Do you want to login now with 'eas login'? [Y/n] " _eas_answer
    _eas_answer=${_eas_answer:-Y}
    if [[ "$_eas_answer" =~ ^[Yy] ]]; then
      echo "🔐 Launching 'eas login'..."
      if ! eas login; then
        echo "❌ EAS login failed or was cancelled. Exiting." >&2
        exit 1
      fi
      echo "✅ EAS login successful"
    else
      echo "❌ EAS login is required to continue. Exiting." >&2
      exit 1
    fi
  else
    echo "✅ EAS is already logged in"
  fi
else
  echo "⚠️  'eas' CLI not found on PATH. Some features may require it."
  read -r -p "Install eas-cli and login? (install guidance will be shown) [y/N] " _eas_install
  if [[ "$_eas_install" =~ ^[Yy] ]]; then
    echo "To install EAS CLI globally run: npm install -g eas-cli"
    echo "After installing, run: eas login"
    echo "Exiting script now so you can install and login." >&2
    exit 1
  else
    echo "Continuing without EAS. Note: some EAS functionality may be unavailable." >&2
  fi
fi

if [ -n "$EXPO_TOKEN" ]; then
  # Make sure the token is exported for child processes
  export EXPO_TOKEN
  echo "🔐 EXPO_TOKEN detected — starting Expo in non-interactive mode (no login prompt)"
else
  echo "⚠️ EXPO_TOKEN not set. To completely bypass login prompts, add EXPO_TOKEN to your .env or environment."
  echo "   Create a token locally with: npx expo login:ci" 
  echo "   This script will still run Expo in --non-interactive mode, but without a token the CLI may exit or run with limited features."
fi

# Start Expo. For dev environments we *don't* force --non-interactive so you can
# choose "Proceed anonymously" or login interactively. If EXPO_TOKEN is present
# use --non-interactive to ensure the CLI won't prompt.
if [ -n "$EXPO_TOKEN" ]; then
  # Non-interactive mode with a token (CI / headless servers)
  echo "🚀 Running: npx expo start --port 8080 --non-interactive"
  npx expo start --port 8080 --non-interactive
else
  # Dev machines: try to run with a pseudo-tty wrapper (expect) so Expo CLI sees a real
  # interactive terminal and will accept a single Enter to proceed anonymously.
  echo "🚀 EXPO_TOKEN not set — attempting to auto-accept anonymous session for dev"

  if command -v expect >/dev/null 2>&1 && [ -x "./scripts/auto-expo-start.expect" ]; then
    echo "🔧 'expect' found — launching Expo via PTY wrapper (auto-accept anonymous)"
    ./scripts/auto-expo-start.expect
  else
    if ! command -v expect >/dev/null 2>&1; then
      echo "⚠️ 'expect' is not installed. To install on Debian/Ubuntu: sudo apt-get install expect"
    else
      echo "⚠️ expect wrapper exists but is not executable: ./scripts/auto-expo-start.expect"
    fi
    echo "🔁 Falling back to piping a newline. This may cause the CLI to detect a non-interactive terminal"
    echo "   and disable keyboard prompts; if that triggers login prompts, consider installing 'expect' or logging in once."
    printf "\n" | npx expo start --port 8080
  fi
fi

# Wait for backend to exit before the script finishes (cleanup trap will run)
wait "$BACKEND_PID" 2>/dev/null || true
