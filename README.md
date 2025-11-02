# WhatsApp Business Platform 📱

A universal WhatsApp business integration platform with a mobile chat widget built with React Native and Expo. Customers can chat with your business through a mobile app, and messages are routed to your WhatsApp Business account.

## ✨ Features

- 📱 **Mobile Chat Widget** - React Native app for customers to contact your business
- 💬 **WhatsApp Integration** - Messages sent directly to your business WhatsApp
- 🌐 **Web Landing Page** - Professional landing page on port 5000
- 🔄 **Real-time Messaging** - Instant message delivery and reply polling
- 🚀 **Universal Deployment** - Auto-detects environment (Replit, VPS, Local)

## 🚀 Quick Start

1. **Install dependencies**

   ```bash
   # Ensure Node.js 18+ and npm are installed
   node -v
   npm -v

   # Install project dependencies
   npm install
   ```

2. **Start the app (recommended)**

   The project includes a convenience script that starts the backend and the Expo dev server together.

   ```bash
   # Make sure the script is executable then run it
   chmod +x start-expo.sh
   bash start-expo.sh
   ```

   The script automatically detects your environment:
   - 🔵 **Replit** - Uses dev domain automatically
   - 🌍 **VPS** - Auto-detects public IP
   - 💻 **Local** - Uses your local network IP

3. **Run components individually (optional)**

   If you'd rather run parts separately:

   - Start only the backend server on port 3000:

     ```bash
     npm run start:backend
     ```

   - Start only the Expo dev server (Metro) for the mobile app:

     ```bash
     npm run start:frontend
     ```

   - Start everything using the convenience npm script (same as running the shell script):

     ```bash
     npm run start:local
     ```

4. **Scan QR Code / open in simulator**

   - Open Expo Go on your phone and scan the displayed QR code (for LAN).
   - Or open the iOS or Android simulator from the Expo DevTools.

Notes:
- The backend server listens on port 3001 by default.
- The web landing page runs on port 5000 when present.
- You can set a custom domain or other env vars before running the script:

```bash
export CUSTOM_DOMAIN=mydomain.example
npm run start:local
```

3. **Scan QR Code**
   - Open Expo Go on your phone
   - Scan the QR code shown in terminal
   - Start chatting!

## 🌐 Universal Deployment

This app works anywhere without configuration changes!

### On Replit (Current)
```bash
bash start-expo.sh
# Automatically uses Replit domain
```

### On a VPS (DigitalOcean, AWS, etc.)
```bash
bash start-expo.sh
# Automatically detects public IP
```

### With Custom Domain
```bash
export CUSTOM_DOMAIN="myapp.com"
bash start-expo.sh
```

### Local Development
```bash
bash start-expo.sh
# Uses your local IP for LAN testing
```

📖 See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 🏗️ Architecture

- **Backend Server** (port 3000) - WhatsApp message handling
- **Expo Metro** (port 8080) - Mobile app development server  
- **Web Frontend** (port 5000) - Landing page
- **No ngrok needed** - Uses native public URLs

## 📁 Project Structure

```
├── app/                 # Expo mobile app (file-based routing)
├── components/          # React Native components
├── server.js           # Backend WhatsApp server
├── web/                # Web landing page
├── start-expo.sh       # Universal startup script
└── DEPLOYMENT.md       # Deployment guide
```

## 🛠️ Configuration

The `start-expo.sh` script handles all configuration automatically. It sets:

- `REACT_NATIVE_PACKAGER_HOSTNAME` - Domain for Expo
- `EXPO_PUBLIC_BACKEND_URL` - Backend API URL
- `EXPO_DEVTOOLS_LISTEN_ADDRESS` - Listen on all interfaces

## 📱 Testing on Mobile

1. Install [Expo Go](https://expo.dev/go) on your phone
2. Make sure your phone is on the same network (for local dev)
3. Scan the QR code displayed in the terminal
4. Start chatting!

## 🔧 Environment Variables

Optional custom configuration:

```bash
CUSTOM_DOMAIN=yourdomain.com     # Custom domain
```

## 📚 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native](https://reactnative.dev/)

## 🤝 Support

For deployment help, see [DEPLOYMENT.md](./DEPLOYMENT.md)
