# CloudPrint Pro - Production Network & Security Checklist

Verify that the deployed environment satisfies all 21 production security and operational requirements:

- [x] **Zero Inbound Ports**: Windows agent PC requires no open inbound WAN ports.
- [x] **No Port-Forwarding**: Router requires no port-forwarding or NAT holes.
- [x] **Outbound TLS**: Agent initiates outbound HTTPS/WSS connections to the Dokploy server.
- [x] **Unique Agent Identity**: Each host possesses an individual `AGENT_ID`.
- [x] **Cryptographic Secret**: Dedicated `PRINT_AGENT_SECRET_KEY` separate from `MPESA_CALLBACK_SECRET`.
- [x] **HMAC-SHA256 Mutual Auth**: All request payloads, methods, paths, timestamps, and nonces are signed.
- [x] **Anti-Replay Defense**: Expired timestamps (>300s) and reused nonces are blocked with `403`.
- [x] **SSRF Protection**: Agent rejects requests targeting localhost or private internal subnets.
- [x] **Universal File Support**: Processes PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, JPG, JPEG, PNG, WEBP.
- [x] **Magic Byte Inspection**: Validates binary headers before opening or converting documents.
- [x] **Macro Isolation**: LibreOffice headless execution blocks macro execution in isolated profiles.
- [x] **Resource Constraints**: Enforces 100MB maximum file size and 120s process timeouts.
- [x] **Paper Normalization**: Scales and centers content to target paper sizes (A4, A5, A3, Letter, Legal).
- [x] **Per-Printer Mutex**: Enforces strictly 1 active physical print job per target printer.
- [x] **Duplicate Print Protection**: Checks completion history before physical spooling to prevent accidental double prints.
- [x] **Persistent Transaction Queue**: Queue state survives unexpected crashes, reboots, and power loss.
- [x] **Zero Data Retention**: Overwrites local document buffers with cryptographic noise before deletion.
- [x] **Automatic Reconnection**: Implements exponential backoff (`2s, 4s, 8s, 16s, 30s, 60s`).
- [x] **Single-Instance Mutex**: Prevents duplicate agent instances on the same host using port 49152.
- [x] **Automated Diagnostics**: `print-agent doctor` verifies all 15 subsystems on demand.
- [x] **Audit Trail**: Every state transition, login, and print dispatch is recorded in audit logs.
