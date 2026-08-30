# CloudPrint Pro - Troubleshooting & Diagnostics Guide

## 1. Quick Health Check: print-agent doctor

Run the diagnostic tool at any time from the agent folder:
```cmd
npm run doctor
```

This verifies:
- Agent credentials & `.env` configuration
- HMAC-SHA256 signature generator
- Server gateway connectivity & TLS status
- Windows Print Spooler service state
- Connected physical printers
- LibreOffice & Image conversion engines
- Zero-retention spool buffer permissions
- Persistent queue integrity

---

## 2. Common Issues & Solutions

### A. Port 49152 Locked / Startup Aborted
**Symptom**: `❌ [STARTUP ABORTED] Another CloudPrint Pro Agent is ALREADY RUNNING!`  
**Cause**: Another agent instance is already active, or a previous process crashed leaving a stale lock file.  
**Resolution**:
1. Check Task Manager for existing `node.exe` processes running the agent.
2. If no process is running, delete `agent\.agent.lock`.

---

### B. Printer Offline or Out of Paper
**Symptom**: Job status changes to `WAITING_FOR_PRINTER`.  
**Cause**: The target printer is turned off, unplugged, or out of paper.  
**Resolution**:
1. Turn on the printer and verify USB/LAN connection.
2. Ensure paper is loaded into the feeder tray.
3. The agent will automatically resume and print the queued job as soon as the printer reports ready.

---

### C. Server Gateway Unreachable (Backoff Mode)
**Symptom**: `⚠️ [CONNECTION BACKOFF] Gateway unreachable. Retrying in 8s...`  
**Cause**: Internet disruption or remote Dokploy container restarting.  
**Resolution**:
- The agent automatically initiates exponential backoff reconnects (`2s, 4s, 8s, 16s, 30s, 60s`).
- Once connectivity is restored, the agent immediately resumes polling.

---

### D. Office Documents Not Converting (DOCX/XLSX/PPTX)
**Symptom**: Warning in `npm run doctor` about LibreOffice.  
**Resolution**:
1. Download and install LibreOffice for Windows (64-bit).
2. The agent will auto-detect `C:\Program Files\LibreOffice\program\soffice.exe`.
