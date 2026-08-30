# CloudPrint Pro - Configuration Reference

## 1. Remote Server (.env)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Server execution mode (`production` / `development`) |
| `PORT` | `3000` | HTTP port on Dokploy container |
| `PRINT_AGENT_SECRET_KEY` | *(Required)* | Secret key used to verify HMAC signatures from the agent |
| `MPESA_CALLBACK_SECRET` | *(Required)* | **Separate** secret for Safaricom Daraja Webhook validation |
| `VAULT_STORAGE_PATH` | `./storage/vault` | Temporary customer document staging path |
| `VAULT_RETENTION_TTL_MINUTES` | `15` | Document auto-purge time-to-live |

---

## 2. Windows Local Agent (agent/.env)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SERVER_URL` | `https://printpro.hudumacyber.shop` | Remote Dokploy server gateway address |
| `AGENT_ID` | `AGT-LAN-01` | Unique agent node identifier |
| `AGENT_TOKEN` | *(Required)* | Shared secret matching `PRINT_AGENT_SECRET_KEY` |
| `POLL_INTERVAL_MS` | `3000` | Queue polling frequency in milliseconds |
| `HEARTBEAT_INTERVAL_MS` | `15000` | Health check & printer status ping frequency |
| `DEFAULT_PRINTER` | `Default` | Target physical printer or `Default` for OS default |
| `PRINTER_A4_BW` | `Default` | Hardware printer routed for A4 Black & White |
| `PRINTER_A4_COLOUR` | `Default` | Hardware printer routed for A4 Full Colour |
| `PRINTER_A3_COLOUR` | `Default` | Hardware printer routed for A3 Format |
| `LIBREOFFICE_PATH` | *(Auto-detected)* | Custom path to `soffice.exe` |
| `AGENT_TEMP_DIR` | `./temp_spool` | Local zero-retention spool buffer directory |
