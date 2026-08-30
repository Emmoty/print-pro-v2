# CloudPrint Pro - Installation Guide

## 1. Prerequisites on Windows Host

1. **Node.js**: v18.0.0 or higher (`node -v`).
2. **Printer Drivers**: Ensure target printers (`HP LaserJet`, `Brother`, `EPSON`) are plugged in and visible under Windows *Printers & Scanners*.
3. **LibreOffice (Optional for Native DOC/DOCX/XLSX/PPTX Conversion)**:
   - Download and install from [libreoffice.org](https://www.libreoffice.org/).
   - Standard path: `C:\Program Files\LibreOffice\program\soffice.exe`.

---

## 2. Agent Setup & Configuration

1. Clone or copy the repository to your Windows PC (e.g. `C:\PrintAgent`).
2. Navigate to the agent folder:
   ```cmd
   cd agent
   npm install --production
   ```
3. Create your `.env` configuration file:
   ```ini
   SERVER_URL=https://printpro.hudumacyber.shop
   AGENT_ID=AGT-LAN-01
   AGENT_TOKEN=your_secure_agent_secret_key
   POLL_INTERVAL_MS=3000
   HEARTBEAT_INTERVAL_MS=15000
   ```

---

## 3. Verify Subsystems with Doctor

Run the comprehensive diagnostic tool:
```cmd
npm run doctor
```
Or:
```cmd
node doctor.js
```

Expected output:
```text
================================================================
🩺 CLOUDPRINT PRO - SECURE PRINT BRIDGE DIAGNOSTIC SUITE
================================================================
  ✔ [PASS] Configuration & Environment (Agent: AGT-LAN-01)
  ✔ [PASS] HMAC-SHA256 Signing Engine
  ✔ [PASS] Server Gateway Connectivity (TLS/HTTP) (HTTP 200)
  ✔ [PASS] Windows Print Spooler Service (Running)
  ✔ [PASS] Printer Discovery & Capabilities
  ✔ [PASS] Image Engine (PNG / JPG / WEBP -> PDF)
  ✔ [PASS] Zero-Retention Spool Directory Permissions
  ✔ [PASS] Persistent Transactional Job Queue
  ✔ [PASS] Single-Instance Mutex Protection
================================================================
🎉 PRINT BRIDGE IS HEALTHY & READY FOR PRODUCTION DISPATCH!
================================================================
```

---

## 4. Running as a Background Windows Service

To start the agent automatically on Windows boot without requiring an open terminal:

1. Right-click `agent\install_service.bat` and select **Run as Administrator**.
2. Alternatively, start manually:
   ```cmd
   node index.js
   ```
