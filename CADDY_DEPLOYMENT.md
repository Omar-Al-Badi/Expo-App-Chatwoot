# Deploy with Caddy and Automatic SSL

This guide shows you how to deploy your chat widget on a VPS with automatic SSL certificates using Caddy.

## Prerequisites

- A VPS (DigitalOcean, Linode, AWS EC2, etc.)
- A domain name pointed to your VPS IP address
- Ubuntu/Debian server (or similar)

## Installation Steps

### 1. Install Caddy

```bash
# Install dependencies
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

# Add Caddy repository
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

# Install Caddy
sudo apt update
sudo apt install caddy
```

### 2. Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Setup Your Application

```bash
# Clone or upload your project
cd /var/www
sudo mkdir chatwoot-chat
sudo chown $USER:$USER chatwoot-chat
cd chatwoot-chat

# Upload your files (server.js, web/, package.json, etc.)
# Then install dependencies
npm install
```

### 4. Configure Environment Variables

```bash
# Create environment file
nano .env
```

Add your Chatwoot credentials:
```env
CHATWOOT_BASE_URL=https://005575.xyz
CHATWOOT_API_TOKEN=your_api_token_here
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_INBOX_ID=2
PORT=3001
```

### 5. Setup Caddyfile

```bash
# Edit the main Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Replace with your domain and paths:
```nginx
{
    email your-email@example.com
}

yourdomain.com {
    encode gzip

    # Webhook endpoint
    handle /webhook/* {
        reverse_proxy localhost:3001
    }
    
    # API endpoints (for chat communication)
    handle /api/* {
        reverse_proxy localhost:3001 {
            header_up Connection {>Connection}
            header_up Upgrade {>Upgrade}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
    
    # Static web files
    root * /var/www/chatwoot-chat/web
    file_server
}
```

### 6. Setup PM2 to Keep Backend Running

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your backend
cd /var/www/chatwoot-chat
pm2 start server.js --name chatwoot-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it gives you (usually starts with 'sudo env...')
```

### 7. Start Caddy

```bash
# Reload Caddy with new configuration
sudo systemctl reload caddy

# Check Caddy status
sudo systemctl status caddy
```

### 8. Update Chatwoot Webhook

In your Chatwoot dashboard, update the webhook URL to:
```
https://yourdomain.com/webhook/chatwoot
```

### 9. Update Android APK

Update `eas.json` with your new domain:
```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://yourdomain.com"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://yourdomain.com"
      }
    }
  }
}
```

Then rebuild:
```bash
eas build --platform android --profile preview
```

## Firewall Configuration

Make sure ports 80 and 443 are open:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

## Useful Commands

```bash
# View Caddy logs
sudo journalctl -u caddy --no-pager | tail -100

# Restart Caddy
sudo systemctl restart caddy

# View backend logs
pm2 logs chatwoot-backend

# Restart backend
pm2 restart chatwoot-backend

# Monitor processes
pm2 monit
```

## SSL Certificate Notes

- Caddy automatically gets SSL certificates from Let's Encrypt
- Certificates are automatically renewed before expiration
- Your domain must point to your server IP (DNS A record)
- Port 80 must be accessible for the ACME challenge

## Testing

1. Visit `https://yourdomain.com` - you should see your web frontend with SSL
2. The chat widget should work and connect to the backend
3. Webhook should receive messages at `https://yourdomain.com/webhook/chatwoot`

## Troubleshooting

### SSL Certificate Not Working
- Check DNS: `dig yourdomain.com`
- Ensure ports 80 and 443 are open
- Check Caddy logs: `sudo journalctl -u caddy -f`

### Backend Not Responding
- Check if Node.js is running: `pm2 list`
- View logs: `pm2 logs chatwoot-backend`
- Restart: `pm2 restart chatwoot-backend`

### Webhook Not Working
- Test webhook endpoint: `curl https://yourdomain.com/webhook/chatwoot`
- Check backend logs for errors
- Verify Chatwoot webhook URL is correct
