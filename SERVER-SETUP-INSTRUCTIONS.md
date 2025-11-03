# Server Setup Instructions - Quick Start

Follow these steps in order to deploy your todo app to `todo.hamishgilbert.com`.

## Step 1: Create Server Directories

Run these commands on your server (100.97.149.13):

```bash
mkdir -p /mnt/user/appdata/todo-app/backend/uploads
mkdir -p /mnt/user/appdata/todo-app/frontend/dist
chown -R root:root /mnt/user/appdata/todo-app
```

## Step 2: Check SSL Certificate

Check if `todo.hamishgilbert.com` is already in your SSL certificate:

```bash
docker exec multi-site-nginx cat /etc/nginx/ssl/renewal/hamishgilbert.com.conf
```

Look for a line like: `todo.hamishgilbert.com = /data/letsencrypt`

**If NOT present**, you need to add it. Run this inside the nginx container:

```bash
# Enter the container
docker exec -it multi-site-nginx sh

# Install certbot (if not already installed)
apk add --no-cache certbot

# Renew certificate with all domains
certbot certonly --webroot \
  -w /usr/share/nginx/letsencrypt-webroot \
  -d hamishgilbert.com \
  -d www.hamishgilbert.com \
  -d mealplanner.hamishgilbert.com \
  -d todo.hamishgilbert.com \
  --non-interactive \
  --agree-tos \
  --email YOUR_EMAIL_HERE

# Exit container
exit

# Restart nginx
docker restart multi-site-nginx
```

## Step 3: Update multi-site-nginx Docker Compose

Edit `/mnt/user/appdata/multi-site-nginx/docker-compose.yml`

Add this line to the volumes section (around line 17, after the calc-portfolio-site volume):

```yaml
- /mnt/user/appdata/todo-app/frontend/dist:/usr/share/nginx/todo-app:rw
```

**Full example of volumes section:**

```yaml
volumes:
  # Mount website directories
  - /mnt/user/appdata/multi-site-nginx/hamish-gilbert-website:/usr/share/nginx/personal-website:rw
  - /mnt/user/appdata/meal-planning-webapp-subdomain/frontend/dist:/usr/share/nginx/mealplanner:rw
  - /mnt/user/appdata/data-learning-site/html:/usr/share/nginx/datalearning:rw
  - /mnt/user/appdata/data-project-site/html:/usr/share/nginx/dataproject:rw
  - /mnt/user/appdata/calc-portfolio-site/html:/usr/share/nginx/calc:rw
  - /mnt/user/appdata/todo-app/frontend/dist:/usr/share/nginx/todo-app:rw  # <-- ADD THIS LINE

  # Mount Let's Encrypt webroot for certificate verification
  - /mnt/user/appdata/multi-site-nginx/letsencrypt-webroot:/usr/share/nginx/letsencrypt-webroot:rw

  # ... rest of config
```

Then recreate the container:

```bash
cd /mnt/user/appdata/multi-site-nginx
docker compose up -d
```

## Step 4: Set Up GitHub Repository

On your **local machine**:

```bash
cd /Users/hamishgilbert/Downloads/Projects/todo-app

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Add deployment configuration for todo.hamishgilbert.com"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/todo-app.git
git branch -M main
git push -u origin main
```

## Step 5: Configure GitHub Secrets

In your GitHub repository:

1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add these three secrets:

### Secret 1: SSH_PRIVATE_KEY

On your **local machine**, create an SSH key for GitHub Actions:

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "github-actions-todo-app" -f ~/.ssh/github_actions_todo_app

# Copy the PRIVATE key (paste entire output into GitHub secret)
cat ~/.ssh/github_actions_todo_app
```

On your **server**, add the public key:

```bash
# Copy public key from local machine
cat ~/.ssh/github_actions_todo_app.pub

# On server, add to authorized_keys
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
```

Or use `ssh-copy-id`:

```bash
# From local machine
ssh-copy-id -i ~/.ssh/github_actions_todo_app.pub root@100.97.149.13
```

### Secret 2: SERVER_IP
Value: `100.97.149.13`

### Secret 3: SERVER_USER
Value: `root`

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

On your **server**:

```bash
# Check containers
docker ps | grep todo-app

# Check backend health
curl http://192.168.1.2:3500/api/health

# View logs
docker logs todo-app-backend
```

In your **browser**:
- Visit https://todo.hamishgilbert.com

## Step 8: DNS Configuration

Make sure `todo.hamishgilbert.com` points to your server:

- **If using Cloudflare**: Add A record: `todo` → `100.97.149.13`
- **If using Tailscale**: Should already work with the Tailscale IP

## Troubleshooting

### Container won't start
```bash
docker logs todo-app-backend
cd /mnt/user/appdata/todo-app
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### 502 Bad Gateway
```bash
# Check if backend is running
docker ps | grep todo-app-backend

# Check backend health
curl http://192.168.1.2:3500/api/health

# Restart backend
docker restart todo-app-backend
```

### SSL Certificate Error
```bash
# Verify certificate includes todo subdomain
docker exec multi-site-nginx openssl x509 -in /etc/nginx/ssl/live/hamishgilbert.com/fullchain.pem -text -noout | grep DNS
```

### Changes not deploying
```bash
# Clear GitHub Actions cache and re-run workflow
# Or manually rebuild:
cd /mnt/user/appdata/todo-app
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d --force-recreate
docker restart multi-site-nginx
```

## Summary of Files

These files were created in your project:

1. **.github/workflows/deploy.yml** - Automated deployment workflow
2. **nginx-config-todo.conf** - Nginx configuration for the subdomain
3. **docker-compose.production.yml** - Production backend setup
4. **DEPLOYMENT.md** - Comprehensive deployment documentation
5. **SERVER-SETUP-INSTRUCTIONS.md** - This quick start guide

## Next Steps After Deployment

1. Test all functionality at https://todo.hamishgilbert.com
2. Set up automated backups for `/mnt/user/appdata/todo-app/backend/todo.db`
3. Monitor logs regularly: `docker logs -f todo-app-backend`
4. Consider setting up monitoring/alerting for the backend service

---

**Need Help?** Refer to `DEPLOYMENT.md` for detailed troubleshooting and maintenance instructions.
