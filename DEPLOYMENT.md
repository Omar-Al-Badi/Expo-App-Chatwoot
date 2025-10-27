# Universal Deployment Guide

This app automatically detects its environment and configures itself accordingly.

## How It Works

The `start-expo.sh` script detects the hosting environment and sets the correct domain:

### Priority Order:
1. **CUSTOM_DOMAIN** (highest priority) - Your custom domain
2. **REPLIT_DEV_DOMAIN** - Automatically detected on Replit
3. **Local IP/localhost** (fallback) - For local development

---

## Platform-Specific Setup

### 🔵 Replit (Current Environment)
**No setup needed!** The script automatically detects Replit and uses the dev domain.

```bash
bash start-expo.sh
```

---

### 💻 Local Development

When running locally, the script will:
- Auto-detect your local IP address for LAN testing
- Use `http://` instead of `https://`

```bash
bash start-expo.sh
```

To test on your phone (same WiFi network):
1. Run the script
2. Scan the QR code with Expo Go
3. Your phone will connect via your local IP

---

### 🌐 Custom Domain (Production)

Set your custom domain via environment variable:

```bash
export CUSTOM_DOMAIN="yourdomain.com"
bash start-expo.sh
```

Or add to `.env` file:
```
CUSTOM_DOMAIN=yourdomain.com
```

---

### 🐳 Docker / Cloud Platforms

For platforms like Heroku, AWS, DigitalOcean, etc.:

**Option 1: Set environment variable**
```bash
CUSTOM_DOMAIN=your-app.herokuapp.com bash start-expo.sh
```

**Option 2: Auto-detect platform**
The script will fall back to localhost if no domain is detected. You can extend the script to detect specific platform variables:

```bash
# Add to start-expo.sh after REPLIT_DEV_DOMAIN check:
elif [ -n "$HEROKU_APP_NAME" ]; then
  DOMAIN="$HEROKU_APP_NAME.herokuapp.com"
  PROTOCOL="https"
```

---

## Environment Variables

The script sets these variables automatically:

- `REACT_NATIVE_PACKAGER_HOSTNAME` - Domain for Expo Metro bundler
- `EXPO_DEVTOOLS_LISTEN_ADDRESS` - Listen on all interfaces (0.0.0.0)
- `EXPO_PUBLIC_BACKEND_URL` - Backend API URL for mobile app

---

## Troubleshooting

### Metro shows internal IP instead of domain
- Make sure `REACT_NATIVE_PACKAGER_HOSTNAME` is exported before running Expo
- The script handles this automatically

### Mobile app can't connect to backend
- Check the backend URL in the logs: `📱 Backend URL: ...`
- Verify the port (3001) is accessible from your mobile device

### Running on a new platform
1. Set `CUSTOM_DOMAIN` environment variable
2. Or extend the script to auto-detect your platform's domain variable
