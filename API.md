# CloudPrint Pro - Print Agent API Reference

## Authentication Headers

All requests from the agent to the server must include:
- `x-agent-id`: Agent identifier (e.g. `AGT-LAN-01`)
- `x-agent-timestamp`: Current Unix timestamp in seconds
- `x-agent-nonce`: Unique 32-character hexadecimal nonce
- `x-agent-signature`: HMAC-SHA256 hash of `METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_SHA256`

---

## Endpoints

### 1. Agent Heartbeat & Telemetry
- **Method**: `POST`
- **Path**: `/api/print/heartbeat`
- **Request Body**:
  ```json
  {
    "agent_id": "AGT-LAN-01",
    "status": "online",
    "version": "2.0.0",
    "hostname": "PRINT-PC",
    "printers": [
      {
        "name": "HP LaserJet Pro MFP M127-M128 PCLmS",
        "default": true,
        "status": "ready"
      }
    ],
    "queue_length": 0
  }
  ```
- **Response**:
  ```json
  {
    "status": "online",
    "timestamp": "2026-08-30T11:20:00.000Z",
    "agentId": "AGT-LAN-01"
  }
  ```

---

### 2. Poll Print Queue
- **Method**: `GET`
- **Path**: `/api/print/poll-queue`
- **Response (If Job Available)**:
  ```json
  {
    "job": {
      "id": "#CP123456",
      "customer": "Customer 5678",
      "phone": "0712345678",
      "fileName": "Document.pdf",
      "paperSize": "a4",
      "colorMode": "bw",
      "copies": 1,
      "pages": 5,
      "total": 5
    },
    "spoolerTimeout": 60
  }
  ```
- **Response (If Queue Empty)**:
  ```json
  {
    "job": null
  }
  ```

---

### 3. Download Job Document
- **Method**: `GET`
- **Path**: `/api/print/job/:id/file`
- **Response**: Binary stream with `Content-Type: application/pdf` or original document MIME type.

---

### 4. Complete Print Job
- **Method**: `POST`
- **Path**: `/api/print/complete-job`
- **Request Body**:
  ```json
  {
    "jobId": "#CP123456",
    "status": "Completed",
    "pagesPrinted": 5,
    "printer": "HP LaserJet Pro MFP M127-M128 PCLmS"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Job completion recorded.",
    "jobId": "#CP123456"
  }
  ```
