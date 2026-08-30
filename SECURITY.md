# CloudPrint Pro - Security Architecture & Hardening

## 1. Zero Trust Network Ingress

- **Outbound-Only TLS**: The agent establishes an outbound HTTPS connection to the Dokploy server. No inbound ports are opened on the Windows host or local router.
- **SSRF Defense**: The agent strictly validates download endpoints against the configured `SERVER_URL` hostname, refusing requests to `127.0.0.1`, `localhost`, or arbitrary LAN addresses.

---

## 2. Authentication & Replay Protection

- **HMAC-SHA256 Signatures**: Every API interaction is cryptographically hashed with method, route, timestamp, nonce, and payload body.
- **Anti-Replay Nonce Tracking**: Used nonces are stored in an in-memory TTL map (10 minutes) on the server. Reused nonces are rejected with `403 NONCE_REUSED`.
- **Clock Skew Window**: Requests older than ±300s are rejected with `403 TIMESTAMP_EXPIRED`.
- **Credential Separation**: `PRINT_AGENT_SECRET_KEY` and `MPESA_CALLBACK_SECRET` are strictly segregated.

---

## 3. Universal Document Sandboxing & Protection

- **Magic Byte Verification**: Rejects forged file extensions by verifying true binary headers (PDF, PNG, JPEG, WEBP, ZIP Office, OLE2).
- **Macro Execution Disabled**: Headless LibreOffice conversions run with `--nodefault --nofirststartwizard --nolockcheck --nologo --norestore` in an isolated ephemeral user profile directory.
- **Resource Constraints**:
  - `MAX_FILE_SIZE_MB`: 100 MB
  - `MAX_CONVERSION_SECONDS`: 120s
  - `MAX_PRINT_TIMEOUT_SECONDS`: 35s
- **Zip-Bomb & Path Traversal Protections**: Rejects oversized decompressions and malicious relative paths (`../`).

---

## 4. Zero Data Retention & Cryptographic Shredding

Once a document is spooled to the physical printer hardware:
1. The local temporary file buffer is overwritten with random cryptographic noise (`crypto.randomBytes(stat.size)`).
2. The file is unlinked (`fs.unlinkSync()`) immediately.
3. The server vault marks the document record purged (`filePurged: true`).
