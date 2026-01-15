# Todo App Deployment Guide

This guide covers deploying the Todo App to a production server with Docker.

## Prerequisites

1. **GitHub Repository**: Your code must be in a GitHub repository
2. **SSH Access**: SSH access to your server
3. **Existing Infrastructure**:
   - Docker and Docker Compose installed
   - Nginx (or similar reverse proxy) for SSL termination
   - SSL certificate for your domain

## Architecture

```
GitHub (Push to main)
    |
GitHub Actions (Build & Deploy)
    |
Your Server
    |
+-------------------------------------+
|  nginx (reverse proxy)              |
|  - Routes your-domain.com           |
|  - Serves frontend static files     |
|  - Proxies /api to backend          |
+-------------------------------------+
              | /api
+-------------------------------------+
|  todo-app-backend (Port 3500)       |
|  - Node.js/Express API              |
|  - SQLite database                  |
|  - File uploads                     |
+-------------------------------------+
```

## Step-by-Step Setup

### 1. Server Directory Setup

SSH into your server and create the necessary directories:

```bash
ssh user@your-server-ip

# Create todo app directories
mkdir -p /path/to/appdata/todo-app/backend/uploads
mkdir -p /path/to/appdata/todo-app/frontend/dist

# Set proper permissions
chown -R root:root /path/to/appdata/todo-app
```

### 2. SSL Certificate Setup

Your SSL certificate needs to include your todo app subdomain.

Using Let's Encrypt:
```bash
certbot certonly --webroot \
  -w /var/www/letsencrypt \
  -d yourdomain.com \
  -d todo.yourdomain.com \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com
```

### 3. Nginx Configuration

Add the todo app to your nginx configuration. See `nginx-config-todo.conf` for a template.

Key configuration points:
- HTTP to HTTPS redirect
- Proxy `/api/` to backend container
- Serve frontend static files
- SSL certificate paths

After adding the configuration:
```bash
nginx -t  # Test configuration
systemctl reload nginx  # or docker restart nginx-container
```

### 4. Configure GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add:

1. **SSH_PRIVATE_KEY**: Your SSH private key for accessing the server
   ```bash
   # On your local machine, create a new SSH key pair if needed:
   ssh-keygen -t ed25519 -C "github-actions-todo-app" -f ~/.ssh/github_actions_todo_app

   # Copy the private key (paste this value into GitHub Secret)
   cat ~/.ssh/github_actions_todo_app

   # Add public key to server
   ssh-copy-id -i ~/.ssh/github_actions_todo_app.pub user@your-server-ip
   ```

2. **SERVER_IP**: Your server's IP address

3. **SERVER_USER**: SSH username (e.g., `root`)

### 5. Push Code to GitHub

```bash
cd /path/to/todo-app

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit with deployment configuration"

# Create GitHub repository and push
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
   curl http://localhost:3500/api/health
   ```

3. **View logs**:
   ```bash
   docker logs todo-app-backend
   ```

4. **Access the app**: https://todo.yourdomain.com

### Update DNS

Make sure your subdomain points to your server IP:
- Add an A record for `todo` pointing to your server IP

## Troubleshooting

### Backend not starting
```bash
docker logs todo-app-backend
docker compose -f docker-compose.production.yml restart
```

### Frontend not loading
```bash
# Check nginx config
nginx -t

# Check nginx logs
docker logs nginx-container  # or check /var/log/nginx/

# Restart nginx
systemctl reload nginx
```

### SSL certificate issues
```bash
# Check certificate validity
ls -la /path/to/ssl/certs/

# View certificate details
openssl x509 -in /path/to/fullchain.pem -text -noout | grep DNS
```

### 502 Bad Gateway
- Backend is not running or crashed
- Check backend logs: `docker logs todo-app-backend`
- Verify backend is listening: `curl http://localhost:3500/api/health`

### Changes not appearing
```bash
# Rebuild and redeploy
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
```

## Manual Deployment (Alternative)

If GitHub Actions doesn't work, you can deploy manually:

```bash
# On your local machine - build frontend
cd /path/to/todo-app/frontend
npm run build

# Copy files to server
scp -r dist/* user@server:/path/to/appdata/todo-app/frontend/dist/
scp -r ../backend/* user@server:/path/to/appdata/todo-app/backend/
scp ../docker-compose.production.yml user@server:/path/to/appdata/todo-app/

# SSH into server
ssh user@server

# Deploy backend
cd /path/to/appdata/todo-app
docker compose -f docker-compose.production.yml up -d --build
```

## Maintenance

### View Logs
```bash
# Backend logs
docker logs -f todo-app-backend

# Follow logs in real-time
docker logs -f todo-app-backend 2>&1 | tail -100
```

### Backup Database
```bash
# Copy database from container
docker cp todo-app-backend:/app/data/todos.db /path/to/backups/todo-app-$(date +%Y%m%d).db
```

### Update Application
Push changes to the `main` branch on GitHub and the deployment will run automatically.

## Files Reference

- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `nginx-config-todo.conf` - Nginx configuration template
- `docker-compose.production.yml` - Production Docker setup for backend

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check Docker logs on the server
4. Verify all configuration files are in place
