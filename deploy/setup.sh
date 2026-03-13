#!/bin/bash
set -e

echo "=== USPTO Search Server Setup ==="

# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install system deps
apt-get install -y nginx certbot python3-certbot-nginx git build-essential

# Install Chromium for Puppeteer
apt-get install -y chromium-browser

# Install PM2
npm install -g pm2

# Create data directory
mkdir -p /opt/uspto-search-data/logs
mkdir -p /opt/uspto-search-data/backups

# Clone or pull repo
if [ -d /opt/uspto-search ]; then
    cd /opt/uspto-search && git pull
else
    git clone https://github.com/mierst/uspto-bulk-search.git /opt/uspto-search
fi

# Install dependencies
cd /opt/uspto-search
npm install

# Build frontend
npm run build:client --workspace=@uspto-search/web

# Copy nginx config
cp deploy/nginx.conf /etc/nginx/sites-available/uspto-search.live
ln -sf /etc/nginx/sites-available/uspto-search.live /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Get SSL certificate (skip if already exists)
if [ ! -f /etc/letsencrypt/live/uspto-search.live/fullchain.pem ]; then
    certbot --nginx -d uspto-search.live --non-interactive --agree-tos -m admin@uspto-search.live
fi

# Test nginx config and reload
nginx -t && systemctl reload nginx

echo ""
echo "=== Setup complete! ==="
echo "Next steps:"
echo "1. Create /opt/uspto-search/packages/web/.env with your credentials"
echo "2. Run: cd /opt/uspto-search && pm2 start packages/web/ecosystem.config.js"
echo "3. Run: pm2 save && pm2 startup"
echo ""
