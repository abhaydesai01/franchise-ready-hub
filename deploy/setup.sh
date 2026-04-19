#!/usr/bin/env bash
# =============================================================================
#  Franchise Ready Hub — EC2 Setup Script
#  Run this on a fresh Ubuntu 22.04 t3.medium instance as the ubuntu user.
#  Usage: bash setup.sh
# =============================================================================
set -e

REPO_URL="https://github.com/abhaydesai01/franchise-ready-hub.git"   # <-- change this
APP_DIR="/home/ubuntu/franchise-ready-hub"

echo ""
echo "============================================="
echo "  STEP 1 — System packages"
echo "============================================="
sudo apt update -y && sudo apt upgrade -y
sudo apt install -y git nginx python3 python3-pip python3-venv redis-server

echo ""
echo "============================================="
echo "  STEP 2 — Node.js 20 + PM2"
echo "============================================="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

echo ""
echo "============================================="
echo "  STEP 3 — Clone repository"
echo "============================================="
if [ -d "$APP_DIR" ]; then
  echo "Directory exists — pulling latest..."
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo ""
echo "============================================="
echo "  STEP 3.5 — Add swap (prevents OOM during build)"
echo "============================================="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "Swap enabled."
else
  echo "Swap already exists, skipping."
fi

echo ""
echo "============================================="
echo "  STEP 4 — Install dependencies"
echo "============================================="
# Root (Vite SPA)
npm install --legacy-peer-deps

# NestJS backend
npm install --prefix backend

# Next.js CRM
npm install --prefix crm

# Flask bot (Python venv)
python3 -m venv freddy_bot/.venv
freddy_bot/.venv/bin/pip install --upgrade pip
freddy_bot/.venv/bin/pip install -r freddy_bot/requirements.txt

echo ""
echo "============================================="
echo "  STEP 5 — Build"
echo "============================================="
# Vite SPA — produces dist/
VITE_API_URL="http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/api/v1" npm run build

# NestJS — produces backend/dist/
NODE_OPTIONS="--max-old-space-size=3072" npm run build --prefix backend

# Next.js CRM — produces crm/.next/
npm run build --prefix crm

echo ""
echo "============================================="
echo "  STEP 6 — Configure Redis"
echo "============================================="
# Bind Redis to localhost only (default on Ubuntu, confirm here)
sudo sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf || true
sudo systemctl enable redis-server
sudo systemctl restart redis-server
echo "Redis status:"
sudo systemctl status redis-server --no-pager | head -5

echo ""
echo "============================================="
echo "  STEP 7 — Configure Nginx"
echo "============================================="
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/franchise
sudo ln -sf /etc/nginx/sites-available/franchise /etc/nginx/sites-enabled/franchise
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo ""
echo "============================================="
echo "  STEP 8 — Start processes with PM2"
echo "============================================="
cd "$APP_DIR"
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup | tail -1 | sudo bash   # register PM2 on system boot

echo ""
echo "============================================="
echo "  DONE"
echo "============================================="
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo ""
echo "  Admin SPA  → http://$PUBLIC_IP"
echo "  API        → http://$PUBLIC_IP/api/v1"
echo "  CRM        → http://$PUBLIC_IP:3000"
echo "  Flask bot  → http://$PUBLIC_IP:5001"
echo ""
echo "  Next step: fill in backend/.env (see backend/.env.example)"
echo "  Then restart API:  pm2 restart nestjs-api && pm2 restart all-workers"
echo ""
