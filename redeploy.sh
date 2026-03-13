#!/bin/bash
set -e

echo "=== Deploying USPTO Search update ==="

cd /opt/uspto-search

# Pull latest
echo "Pulling latest from main..."
git pull origin main

# Install deps (in case new packages were added)
echo "Installing dependencies..."
npm install

# Rebuild frontend
echo "Building client..."
npm run build:client --workspace=@uspto-search/web

# Restart server
echo "Restarting PM2..."
pm2 restart uspto-search-web

echo ""
pm2 logs uspto-search-web --lines 5 --nostream
echo ""
echo "=== Deploy complete ==="
