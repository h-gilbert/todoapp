# Server Setup Instructions - Quick Start

Follow these steps in order to deploy your todo app to your server.

## Prerequisites

- A server with Docker installed
- SSH access to the server
- A domain name pointing to your server
- An nginx reverse proxy (or similar) for SSL termination

## Step 1: Create Server Directories

Run these commands on your server:

```bash
mkdir -p /path/to/appdata/todo-app/backend/uploads
mkdir -p /path/to/appdata/todo-app/frontend/dist
chown -R root:root /path/to/appdata/todo-app
```

## Step 2: SSL Certificate Setup

If using Let's Encrypt with certbot:

```bash
# Install certbot (if not already installed)
apt install certbot  # or apk add certbot for Alpine

# Get certificate for your domain
certbot certonly --webroot \
  -w /var/www/letsencrypt \
  -d yourdomain.com \
  -d todo.yourdomain.com \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com
```

## Step 3: Configure Nginx

Add the todo app configuration to your nginx setup. See `nginx-config-todo.conf` for an example configuration.

Key points:
- Serve frontend static files from the frontend dist directory
- Proxy `/api/` requests to the backend container on port 3500
- Enable SSL with your certificates

## Step 4: Set Up GitHub Repository

```bash
cd /path/to/todo-app

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/todo-app.git
git branch -M main
git push -u origin main
```

## Step 5: Configure GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add:

### Required Secrets

1. **SSH_PRIVATE_KEY**: Your SSH private key for accessing the server
   ```bash
   # Generate new SSH key
   ssh-keygen -t ed25519 -C "github-actions-todo-app" -f ~/.ssh/github_actions_todo_app

   # Copy the PRIVATE key (paste entire output into GitHub secret)
   cat ~/.ssh/github_actions_todo_app

   # Add public key to server's authorized_keys
   ssh-copy-id -i ~/.ssh/github_actions_todo_app.pub user@your-server-ip
   ```

2. **SERVER_IP**: Your server's IP address

3. **SERVER_USER**: SSH username (e.g., `root`)

## Step 6: Deploy

Push to main branch or manually trigger the workflow:

```bash
git push origin main
```

Or in GitHub:
1. Go to **Actions** tab
2. Select **Deploy Todo App to Production**
3. Click **Run workflow**

## Step 7: Verify Deployment

On your server:

```bash
# Check containers
docker ps | grep todo-app

# Check backend health
curl http://localhost:3500/api/health

# View logs
docker logs todo-app-backend
```

In your browser:
- Visit https://todo.yourdomain.com

## Troubleshooting

### Container won't start
```bash
docker logs todo-app-backend
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### 502 Bad Gateway
```bash
# Check if backend is running
docker ps | grep todo-app-backend

# Check backend health
curl http://localhost:3500/api/health

# Restart backend
docker restart todo-app-backend
```

### SSL Certificate Error
```bash
# Verify certificate includes your subdomain
openssl x509 -in /path/to/fullchain.pem -text -noout | grep DNS
```

### Changes not deploying
```bash
# Rebuild without cache
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d --force-recreate
```

## Summary of Files

These files are used for deployment:

1. **.github/workflows/deploy.yml** - Automated deployment workflow
2. **nginx-config-todo.conf** - Nginx configuration template
3. **docker-compose.production.yml** - Production backend setup

## Next Steps After Deployment

1. Test all functionality at your domain
2. Set up automated backups for the SQLite database
3. Monitor logs regularly: `docker logs -f todo-app-backend`
4. Consider setting up monitoring/alerting for the backend service
