#!/bin/bash
# EC2 first-boot bootstrap for MBUTOMS WhatsApp bridge (Ubuntu 22.04).
set -euxo pipefail
exec > /var/log/mbutoms-bridge-bootstrap.log 2>&1

export DEBIAN_FRONTEND=noninteractive

REPO_URL="${MBUTOMS_REPO_URL:-https://github.com/SalmanLnD/MBUTOMS.git}"
INSTALL_DIR="/opt/MBUTOMS"

echo "=== MBUTOMS WhatsApp bridge bootstrap started at $(date -Is) ==="

# 2 GB swap helps headless Chromium on t2/t3.micro (1 GB RAM).
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update -y
apt-get install -y curl git ca-certificates gnupg

# Node.js 20 LTS
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Chromium + libraries required by Puppeteer / whatsapp-web.js
apt-get install -y \
  chromium-browser \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libxss1 \
  xdg-utils

npm install -g pm2

mkdir -p /opt
if [ ! -d "$INSTALL_DIR/.git" ]; then
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR/whatsapp-bridge"
npm install

chown -R ubuntu:ubuntu "$INSTALL_DIR" || true
sudo -u ubuntu git config --global --add safe.directory "$INSTALL_DIR"

echo "=== Bootstrap complete at $(date -Is) ==="
touch /var/log/mbutoms-bridge-bootstrap.done
echo "Next: copy .env to $INSTALL_DIR/whatsapp-bridge/.env and run pm2 start ecosystem.config.cjs" \
  > /home/ubuntu/BRIDGE_SETUP_NEXT.txt
chown ubuntu:ubuntu /home/ubuntu/BRIDGE_SETUP_NEXT.txt || true
