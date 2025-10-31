# Docker Deployment Guide

Deploy your Chatwoot Chat Widget with Docker and automatic SSL certificates.

## Prerequisites

- Docker and Docker Compose installed
- A domain name pointed to your server IP
- Ports 80 and 443 open

## Quick Start

### 1. Install Docker (Ubuntu/Debian)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Add your user to docker group (optional)
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Prepare Your Project

```bash
# Clone or upload your project files
cd /var/www
git clone your-repo chatwoot-chat
# OR upload files via SCP/SFTP

cd chatwoot-chat
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your Chatwoot credentials
nano .env
```

Add your actual values:
```env
CHATWOOT_BASE_URL=https://005575.xyz
CHATWOOT_API_TOKEN=your_actual_token_here
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_INBOX_ID=2
```

### 4. Update Caddyfile

```bash
nano Caddyfile
```

Replace `yourdomain.com` with your actual domain and add your email:
```nginx
{
    email your-email@example.com
}

yourdomain.com {
    # ... rest of config
}
```

### 5. Deploy

```bash
# Build and start containers
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## Deployment Commands

### Start Services
```bash
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f caddy
```

### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart backend
```

### Update Application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build
```

### Check Container Status
```bash
docker compose ps
```

## SSL Certificate Setup

Caddy will automatically:
1. Request SSL certificates from Let's Encrypt
2. Configure HTTPS
3. Redirect HTTP → HTTPS
4. Renew certificates before expiration

**Requirements:**
- Your domain must point to your server IP (A record)
- Ports 80 and 443 must be accessible
- First request may take a few seconds while getting certificates

## Update Chatwoot Webhook

After deployment, update your Chatwoot webhook URL to:
```
https://yourdomain.com/webhook/chatwoot
```

## Update Android APK

Update `eas.json`:
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

Rebuild APK:
```bash
eas build --platform android --profile preview
```

## Firewall Configuration

### UFW (Ubuntu)
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### Firewalld (CentOS/RHEL)
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Monitoring & Maintenance

### Check Container Health
```bash
docker compose ps
docker stats
```

### View Specific Logs
```bash
# Last 100 lines
docker compose logs --tail=100 backend

# Follow logs in real-time
docker compose logs -f caddy
```

### Access Container Shell
```bash
# Backend container
docker compose exec backend sh

# Caddy container
docker compose exec caddy sh
```

### Backup SSL Certificates
```bash
# Certificates are in Docker volume
docker volume ls
docker run --rm -v chatwoot-chat_caddy_data:/data \
  -v $(pwd)/backup:/backup alpine \
  tar czf /backup/caddy_certificates.tar.gz /data
```

## Troubleshooting

### SSL Certificate Not Working
```bash
# Check Caddy logs
docker compose logs caddy

# Verify DNS
dig yourdomain.com

# Test port 80 accessibility
curl -I http://yourdomain.com
```

### Backend Connection Issues
```bash
# Check backend logs
docker compose logs backend

# Test backend health
docker compose exec caddy wget -O- http://backend:3001/api/health
```

### Container Won't Start
```bash
# Check logs
docker compose logs backend

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Reset Everything
```bash
# Stop and remove everything
docker compose down -v

# Remove images
docker compose down --rmi all

# Start fresh
docker compose up -d --build
```

## Performance Tuning

### Limit Container Resources
Edit `docker-compose.yml`:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### Enable Auto-restart on Failure
Already configured with `restart: unless-stopped`

## Security Best Practices

1. **Use environment variables** - Never commit secrets to Git
2. **Keep Docker updated** - `docker version` and update regularly
3. **Limit exposed ports** - Only 80 and 443 externally
4. **Monitor logs** - Check for suspicious activity
5. **Regular updates** - Keep images updated: `docker compose pull`

## Production Checklist

- [ ] Domain DNS configured (A record)
- [ ] Firewall ports 80, 443 open
- [ ] `.env` file configured with real credentials
- [ ] Caddyfile updated with your domain and email
- [ ] Containers running: `docker compose ps`
- [ ] SSL certificate obtained (check logs)
- [ ] Webhook updated in Chatwoot dashboard
- [ ] Android APK rebuilt with production URL
- [ ] Test chat functionality end-to-end

## Scaling

To run multiple backend instances (load balancing):

```yaml
services:
  backend:
    deploy:
      replicas: 3
```

Then update Caddyfile:
```nginx
yourdomain.com {
    reverse_proxy backend:3001 {
        lb_policy round_robin
    }
}
```

## Support

Common issues:
- **Port already in use**: Another service is using port 80/443
- **Permission denied**: Add user to docker group or use sudo
- **Container exits immediately**: Check logs with `docker compose logs`
