# CloudPrint Pro - Testing & Validation Guide

## 1. Automated Test Suites

### A. Server Security & API Hardening Suite
Executes all 17 security, RBAC, state machine, M-Pesa Daraja, and zero-retention tests:
```bash
npm test
```

### B. Print Bridge Diagnostic Tool
Verifies all 15 local agent and Windows spooler subsystems:
```bash
node agent/doctor.js
```

### C. Universal Document & Image Pipeline Verification
Tests conversion of PDF, DOCX, XLSX, PPTX, JPG, PNG, WEBP, and Plain Text:
```bash
node scratch/test_universal_converter.js
```

### D. HMAC-SHA256 Anti-Replay Security Test
Verifies signature validation, clock skew rejection, and replay nonce blocking:
```bash
node scratch/test_hmac_auth_replay.js
```

### E. End-to-End Customer Order to Spooler Dispatch Test
Simulates full flow from upload to vault, M-Pesa settlement, agent polling, and printer spooling:
```bash
node scratch/test_customer_order_and_agent_spool.js
```
