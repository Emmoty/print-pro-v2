#!/usr/bin/env bash
# ==============================================================================
# CloudPrint Pro - Linux / Raspberry Pi Systemd Service Installer
# ==============================================================================

set -e

SERVICE_NAME="cloudprint-agent"
AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$(which node || echo "/usr/bin/node")"

echo "================================================================"
echo "CloudPrint Pro - Local LAN Print Agent Systemd Installer"
echo "================================================================"

if [ "$EUID" -ne 0 ]; then
  echo "⚠️ Please run as root (sudo ./install_service.sh)"
  exit 1
fi

echo "[1/4] Installing agent dependencies..."
cd "$AGENT_DIR"
npm install --no-audit

if [ ! -f "$AGENT_DIR/.env" ]; then
  echo "[2/4] Initializing .env configuration..."
  cp "$AGENT_DIR/.env.example" "$AGENT_DIR/.env"
  echo "Please edit $AGENT_DIR/.env with your VPS SERVER_URL and AGENT_TOKEN."
fi

echo "[3/4] Creating systemd service file (/etc/systemd/system/${SERVICE_NAME}.service)..."
cat <<EOF > "/etc/systemd/system/${SERVICE_NAME}.service"
[Unit]
Description=CloudPrint Pro Local Edge Print Agent Daemon
After=network.target cups.service

[Service]
Type=simple
User=$(logname || echo "root")
WorkingDirectory=${AGENT_DIR}
ExecStart=${NODE_BIN} ${AGENT_DIR}/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "[4/4] Enabling and starting service..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo "================================================================"
echo "✅ CloudPrint Pro Agent Service is now RUNNING in background!"
echo "Check status anytime with: sudo systemctl status ${SERVICE_NAME}"
echo "View live logs with:       sudo journalctl -u ${SERVICE_NAME} -f"
echo "================================================================"
