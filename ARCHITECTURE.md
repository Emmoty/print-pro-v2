# CloudPrint Pro - Secure Enterprise Print Bridge Architecture

## 1. High-Level Architectural Diagram

```text
                         PUBLIC INTERNET
                                │
                                │ HTTPS / WSS
                                ▼
                     ┌─────────────────────┐
                     │   DOKPLOY SERVER    │
                     │                     │
                     │  Web Application    │
                     │  Print API Routes   │
                     │  HMAC Auth Verifier │
                     │  Zero-Retention DB  │
                     └──────────┬──────────┘
                                │
                                │ OUTBOUND-ONLY PERSISTENT TLS CONNECTION
                                │ (Initiated by Local Agent - Zero Inbound Ports)
                                ▼
                     ┌─────────────────────┐
                     │     WINDOWS PC      │
                     │                     │
                     │  Local Print Agent  │
                     │  HMAC Signer        │
                     │  Persistent Queue   │
                     │  Universal Pipeline │
                     │  (Office / Images)  │
                     │  Windows Spooler    │
                     └──────────┬──────────┘
                                │
                                │ LOCAL USB / LAN (WSD / RAW 9100)
                                ▼
                     ┌─────────────────────┐
                     │   PHYSICAL PRINTER  │
                     │                     │
                     │  HP LaserJet Pro    │
                     │  Brother DCP Series │
                     │  EPSON L220 Series  │
                     └─────────────────────┘
```

---

## 2. Ingress & Egress Security Paradigm

- **Zero Inbound Ports**: The Windows PC does not open, expose, or listen on any public WAN port (`80`, `443`, `8080`, `5000`, `8000`, `9000`).
- **No Router Port-Forwarding**: The agent establishes an outbound HTTPS/WSS connection directly to the remote Dokploy instance.
- **NAT & Firewall Traversal**: Operates seamlessly behind standard residential, office, or cyber café firewalls and dynamic NAT routers.
- **Optional Private Networking**: Compatible with Tailscale mesh tunnels (`https://100.x.y.z`) as an added zero-trust private network layer.

---

## 3. Mutual Authentication & Anti-Replay Engine

Every request dispatched by the local print bridge is cryptographically signed using **HMAC-SHA256**:

```text
CanonicalString =
    METHOD + "\n" +
    PATH + "\n" +
    TIMESTAMP + "\n" +
    NONCE + "\n" +
    BODY_SHA256

Signature = HMAC-SHA256(AGENT_SECRET, CanonicalString)
```

### Request Headers:
- `X-Agent-ID`: Unique agent hardware identifier (e.g. `AGT-LAN-01`).
- `X-Agent-Timestamp`: Unix epoch timestamp in seconds. Rejections trigger if clock skew exceeds ±300s.
- `X-Agent-Nonce`: Cryptographically secure 128-bit random hexadecimal string. Server caches used nonces for 10 minutes to reject replay attacks.
- `X-Agent-Signature`: Hexadecimal HMAC-SHA256 hash.

---

## 4. Universal Document & Image Pipeline

```text
Untrusted Upload (PDF / DOCX / XLSX / PPTX / Images)
   │
   ▼
[1] Magic Byte & MIME Validation
   │
   ▼
[2] Format Classifier
   ├── PDF ────────────────────────────► Validated PDF Stream
   ├── DOC / DOCX / PPT / PPTX / XLS ──► Headless LibreOffice Sandbox (120s Timeout) ──► Normalized PDF
   └── JPG / JPEG / PNG / WEBP ────────► EXIF / Aspect-Ratio / Center Scaler ──────────► Normalized PDF
   │
   ▼
[3] Windows Print Spooler (Per-Printer Mutex Lock)
   │
   ▼
[4] Hardware Spooling & Driver Execution
   │
   ▼
[5] Cryptographic Zero-Retention Shredding (Random bytes overwrite + unlink)
```

---

## 5. Fault-Tolerance & State Persistence

- **Crash-Resilient Queue**: State persisted to transactional `queue.json` on disk.
- **Lease Timeout Recycling**: Stalled jobs automatically recycled after 60s.
- **Duplicate Print Protection**: Completed `job_id` tracking guarantees that network drops, agent restarts, or webhook retries never trigger accidental duplicate physical printing.
