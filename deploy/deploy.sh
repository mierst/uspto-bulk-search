#!/bin/bash
set -e

echo "=== Deploying USPTO Search update ==="

cd /opt/uspto-search

# Pull latest
git pull origin main

# Install deps
npm install

# Rebuild frontend
npm run build:client --workspace=@uspto-search/web

# Restart server
pm2 restart uspto-search-web

echo "=== Deploy complete ==="
