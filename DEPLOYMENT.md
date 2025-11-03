# Todo App Deployment Guide

This guide will help you deploy the Todo App to your Unraid server at `todo.hamishgilbert.com`.

## Prerequisites

1. **GitHub Repository**: Your code must be in a GitHub repository
2. **SSH Access**: SSH access to your Unraid server (100.97.149.13)
3. **Existing Infrastructure**:
   - `multi-site-nginx` container running
   - SSL certificate for hamishgilbert.com

## Architecture

```
GitHub (Push to main)
    ↓
GitHub Actions (Build & Deploy)
    ↓
Unraid Server (100.97.149.13)
    ↓
┌─────────────────────────────────────┐
│  multi-site-nginx (Port 9080/9443) │
│  - Routes todo.hamishgilbert.com    │
│  - Serves frontend static files     │
│  - Proxies /api to backend          │
└─────────────────────────────────────┘
              ↓ /api
┌─────────────────────────────────────┐
│  todo-app-backend (Port 3500)       │
│  - Node.js/Express API              │
│  - SQLite database                  │
│  - File uploads                     │
└─────────────────────────────────────┘
```

## Step-by-Step Setup

### 1. Server Directory Setup

SSH into your server and create the necessary directories:

```bash
ssh root@100.97.149.13

# Create todo app directories
mkdir -p /mnt/user/appdata/todo-app/backend/uploads
mkdir -p /mnt/user/appdata/todo-app/frontend/dist

# Set proper permissions
chown -R root:root /mnt/user/appdata/todo-app
```

### 2. Update SSL Certificate

Your existing SSL certificate needs to include `todo.hamishgilbert.com`.

Check current certificate domains:
```bash
docker exec multi-site-nginx cat /etc/nginx/ssl/renewal/hamishgilbert.com.conf
```

If `todo.hamishgilbert.com` is not listed, you need to renew your certificate:

```bash
# Install certbot in the container (if not already installed)
docker exec -it multi-site-nginx sh
apk add --no-cache certbot

# Renew certificate with new subdomain
certbot certonly --webroot \
  -w /usr/share/nginx/letsencrypt-webroot \
  -d hamishgilbert.com \
  -d www.hamishgilbert.com \
  -d mealplanner.hamishgilbert.com \
  -d todo.hamishgilbert.com \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com

# Exit container
exit

# Restart nginx to load new certificate
docker restart multi-site-nginx
```

### 3. Update multi-site-nginx Docker Compose

Edit `/mnt/user/appdata/multi-site-nginx/docker-compose.yml` and add the todo app volume:

```yaml
services:
  multi-site-nginx:
    image: nginx:alpine
    container_name: multi-site-nginx
    restart: unless-stopped
    ports:
      - "9080:80"
      - "9443:443"
    volumes:
      # Existing volumes...
      - /mnt/user/appdata/multi-site-nginx/hamish-gilbert-website:/usr/share/nginx/personal-website:rw
      - /mnt/user/appdata/meal-planning-webapp-subdomain/frontend/dist:/usr/share/nginx/mealplanner:rw
      - /mnt/user/appdata/data-learning-site/html:/usr/share/nginx/datalearning:rw
      - /mnt/user/appdata/data-project-site/html:/usr/share/nginx/dataproject:rw
      - /mnt/user/appdata/calc-portfolio-site/html:/usr/share/nginx/calc:rw

      # ADD THIS LINE for todo app
      - /mnt/user/appdata/todo-app/frontend/dist:/usr/share/nginx/todo-app:rw

      # Existing config volumes...
      - /mnt/user/appdata/multi-site-nginx/letsencrypt-webroot:/usr/share/nginx/letsencrypt-webroot:rw
      - /mnt/user/appdata/multi-site-nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /mnt/user/appdata/multi-site-nginx/conf.d:/etc/nginx/conf.d:ro
      - /mnt/user/appdata/multi-site-nginx/ssl:/etc/nginx/ssl:ro
```

After editing, restart the nginx container:
```bash
cd /mnt/user/appdata/multi-site-nginx
docker compose up -d
```

### 4. Configure GitHub Secrets

In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add:

1. **SSH_PRIVATE_KEY**: Your SSH private key for accessing the server
   ```bash
   # On your local machine, create a new SSH key pair if needed:
   ssh-keygen -t ed25519 -C "github-actions-todo-app" -f ~/.ssh/github_actions_todo_app

   # Copy the private key (paste this value into GitHub Secret)
   cat ~/.ssh/github_actions_todo_app

   # Add public key to server
   ssh-copy-id -i ~/.ssh/github_actions_todo_app.pub root@100.97.149.13
   ```

2. **SERVER_IP**: `100.97.149.13`

3. **SERVER_USER**: `root`

### 5. Push Code to GitHub

If you haven't already, initialize a git repository and push to GitHub:

```bash
cd /Users/hamishgilbert/Downloads/Projects/todo-app

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit with deployment configuration"

# Create GitHub repository and push
# (Follow GitHub's instructions to create a new repository)
git remote add origin https://github.com/YOUR-USERNAME/todo-app.git
git branch -M main
git push -u origin main
```

### 6. Deploy

The deployment will automatically run when you push to the `main` branch. You can also manually trigger it:

1. Go to your GitHub repository
2. Click **Actions**
3. Select **Deploy Todo App to Production**
4. Click **Run workflow**

## Post-Deployment

### Verify Deployment

1. **Check containers**:
   ```bash
   docker ps | grep todo-app
   ```

2. **Check backend health**:
   ```bash
   curl http://192.168.1.2:3500/api/health
   ```

3. **View logs**:
   ```bash
   docker logs todo-app-backend
   ```

4. **Access the app**: https://todo.hamishgilbert.com

### Update DNS

Make sure `todo.hamishgilbert.com` points to your server IP:
- If using Cloudflare/DNS provider: Add an A record for `todo` pointing to `100.97.149.13`
- If using Tailscale: The IP `100.97.149.13` should already be accessible

## Troubleshooting

### Backend not starting
```bash
docker logs todo-app-backend
docker compose -f /mnt/user/appdata/todo-app/docker-compose.production.yml restart
```

### Frontend not loading
```bash
# Check nginx config
docker exec multi-site-nginx nginx -t

# Check nginx logs
docker logs multi-site-nginx

# Restart nginx
docker restart multi-site-nginx
```

### SSL certificate issues
```bash
# Check certificate validity
docker exec multi-site-nginx ls -la /etc/nginx/ssl/live/hamishgilbert.com/

# View certificate details
docker exec multi-site-nginx openssl x509 -in /etc/nginx/ssl/live/hamishgilbert.com/fullchain.pem -text -noout | grep DNS
```

### 502 Bad Gateway
- Backend is not running or crashed
- Check backend logs: `docker logs todo-app-backend`
- Verify backend is listening: `curl http://192.168.1.2:3500/api/health`

### Changes not appearing
```bash
# Rebuild and redeploy
cd /mnt/user/appdata/todo-app
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
docker restart multi-site-nginx
```

## Manual Deployment (Alternative)

If GitHub Actions doesn't work, you can deploy manually:

```bash
# On your local machine - build frontend
cd /Users/hamishgilbert/Downloads/Projects/todo-app/frontend
npm run build

# Copy files to server
scp -r dist/* root@100.97.149.13:/mnt/user/appdata/todo-app/frontend/dist/
scp -r ../backend/* root@100.97.149.13:/mnt/user/appdata/todo-app/backend/
scp ../docker-compose.production.yml root@100.97.149.13:/mnt/user/appdata/todo-app/
scp ../nginx-config-todo.conf root@100.97.149.13:/mnt/user/appdata/multi-site-nginx/conf.d/todo.conf

# SSH into server
ssh root@100.97.149.13

# Deploy backend
cd /mnt/user/appdata/todo-app
docker compose -f docker-compose.production.yml up -d --build

# Restart nginx
docker restart multi-site-nginx
```

## Maintenance

### View Logs
```bash
# Backend logs
docker logs -f todo-app-backend

# Nginx logs
docker logs -f multi-site-nginx
```

### Backup Database
```bash
# Copy database from container
docker cp todo-app-backend:/app/todo.db /mnt/user/backups/todo-app-$(date +%Y%m%d).db
```

### Update Application
Simply push changes to the `main` branch on GitHub and the deployment will run automatically.

## Files Created

- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `nginx-config-todo.conf` - Nginx configuration for todo subdomain
- `docker-compose.production.yml` - Production Docker setup for backend
- `DEPLOYMENT.md` - This documentation file

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check Docker logs on the server
4. Verify all configuration files are in place
