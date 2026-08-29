# CloudPrint Pro — Local LAN Print Agent

The **CloudPrint Pro Print Agent** is a lightweight, background daemon that runs on a computer or Raspberry Pi connected to your local printer network (LAN). It securely bridges physical printers with your CloudPrint Pro web application on your VPS.

---

## 🏗️ Architecture & Security

```
[ Customer Phone / Browser ]
             │ (Upload document & M-Pesa STK push)
             ▼
[ VPS / Cloud Server (HTTPS) ] ◄── PostgreSQL Database
             │
             │ (Encrypted HTTPS Polling via Mutual HMAC Authentication)
             ▼
[ Local LAN Print Agent (PC / Raspberry Pi) ]
             │
             │ (OS Spooler / CUPS / RAW Socket Port 9100)
             ▼
[ Physical Printers (Laser / Inkjet / MFP) ]
```

- **Zero Inbound Ports**: The agent initiates all outbound HTTPS requests to your VPS. No port forwarding or public IP is required at your shop.
- **Mutual HMAC Authentication**: Authenticates with `x-agent-id` and `x-agent-token` to prevent unauthorized queue access.
- **Zero Data Retention**: Document payloads are held in memory/temp disk only while spooling and are cryptographically overwritten and shredded immediately upon print confirmation.
- **Smart Capability Routing**: Automatically routes jobs to specific printers based on paper format (A4 / A3) and color mode (Color / Monochrome).

---

## 🚀 Quickstart Guide

### 1. Requirements
- Node.js v18+ installed on the local kiosk computer
- Printer(s) installed and tested on the local operating system (Windows / Linux / macOS)

### 2. Configuration (`.env`)
Copy `.env.example` to `.env`:

```env
# URL of your cloud VPS
SERVER_URL=https://printpro.ke

# Matching security credentials configured on your server
AGENT_ID=AGT-LAN-01
AGENT_TOKEN=cloudprint_agent_secret_key_01

# Polling frequency
POLL_INTERVAL_MS=3000

# Printer Mappings (Names as listed in Windows Control Panel or CUPS)
PRINTER_A4_BW=Default
PRINTER_A4_COLOUR=Default
PRINTER_A3_BW=Default
PRINTER_A3_COLOUR=Default
DEFAULT_PRINTER=Default
```

---

## 💻 Running the Agent

### On Windows
Double-click `install_service.bat` or run:
```cmd
cd agent
npm install
npm start
```

### On Linux / Raspberry Pi (Systemd Service)
```bash
cd agent
sudo chmod +x install_service.sh
sudo ./install_service.sh
```

---

## 🔍 Diagnostics & Verification
- **Status**: `sudo systemctl status cloudprint-agent`
- **Live Logs**: `sudo journalctl -u cloudprint-agent -f`
