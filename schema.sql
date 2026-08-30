-- =============================================================================
-- CloudPrint Pro - PostgreSQL Production Database Schema
-- Run this on your VPS PostgreSQL instance or let lib/db.js auto-migrate.
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'operator',
  role_label VARCHAR(128) NOT NULL DEFAULT 'Counter Operator',
  phone VARCHAR(64),
  password_hash VARCHAR(512) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  customer VARCHAR(255),
  phone VARCHAR(64),
  file_name VARCHAR(255),
  files JSONB,
  service_name VARCHAR(128),
  paper_size VARCHAR(32),
  color_mode VARCHAR(32),
  rate_per_page NUMERIC(10, 2),
  pages INT DEFAULT 1,
  copies INT DEFAULT 1,
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(64) DEFAULT 'Pending Payment',
  lifecycle_state VARCHAR(64) DEFAULT 'PAYMENT_PENDING',
  checkout_request_id VARCHAR(128),
  merchant_request_id VARCHAR(128),
  mpesa_receipt_number VARCHAR(128),
  mpesa_ref VARCHAR(128),
  reversal_ref VARCHAR(128),
  refund_amount NUMERIC(10, 2),
  reversal_reason TEXT,
  reversal_timestamp TIMESTAMP WITH TIME ZONE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  file_purged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS printers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  model VARCHAR(255),
  type VARCHAR(128),
  ip VARCHAR(64),
  port VARCHAR(64),
  protocol VARCHAR(64),
  status VARCHAR(64) DEFAULT 'ready',
  status_label VARCHAR(128),
  location VARCHAR(255),
  uptime VARCHAR(64),
  paper_jam BOOLEAN DEFAULT FALSE,
  jam_location VARCHAR(128),
  cover_open BOOLEAN DEFAULT FALSE,
  temperature INT,
  spool_queue INT DEFAULT 0,
  supplies JSONB,
  paper_trays JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255),
  os VARCHAR(128),
  ip VARCHAR(64),
  version VARCHAR(64),
  status VARCHAR(64) DEFAULT 'connected',
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  assigned_printers JSONB,
  jobs_processed INT DEFAULT 0,
  jobs_success INT DEFAULT 0,
  jobs_failed INT DEFAULT 0,
  token_hash VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing (
  id INT PRIMARY KEY DEFAULT 1,
  a4_bw NUMERIC(10, 2) DEFAULT 1.00,
  a4_colour NUMERIC(10, 2) DEFAULT 3.00,
  a3_bw NUMERIC(10, 2) DEFAULT 2.00,
  a3_colour NUMERIC(10, 2) DEFAULT 5.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms (
  id INT PRIMARY KEY DEFAULT 1,
  announcement TEXT,
  banner_active BOOLEAN DEFAULT TRUE,
  paybill_no VARCHAR(64) DEFAULT '892100',
  whatsapp_contact VARCHAR(64) DEFAULT '+254 712 345 678',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  business_name VARCHAR(255) DEFAULT 'CloudPrint Pro - Counter Kiosk #1',
  currency VARCHAR(64) DEFAULT 'KES (Kenya Shillings)',
  timezone VARCHAR(64) DEFAULT 'Africa/Nairobi',
  support_phone VARCHAR(64) DEFAULT '+254 712 345 678',
  default_paper VARCHAR(32) DEFAULT 'a4',
  default_color VARCHAR(32) DEFAULT 'bw',
  max_file_size INT DEFAULT 50,
  max_pages INT DEFAULT 300,
  spooler_timeout INT DEFAULT 60,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  meta JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(64) PRIMARY KEY,
  job_id VARCHAR(64),
  mpesa_receipt_number VARCHAR(128) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'SETTLED',
  raw_callback JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Schema Auto-Patching (Ensures existing tables acquire newly added columns)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_request_id VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS merchant_request_id VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_receipt_number VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_ref VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lifecycle_state VARCHAR(64) DEFAULT 'PAYMENT_PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS file_purged BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reversal_ref VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reversal_timestamp TIMESTAMP WITH TIME ZONE;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mpesa_receipt_number VARCHAR(128);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS raw_callback JSONB;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_checkout_request_id ON orders(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_request_id ON orders(merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_orders_mpesa_receipt ON orders(mpesa_receipt_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_transactions_job_id ON transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receipt ON transactions(mpesa_receipt_number);
CREATE INDEX IF NOT EXISTS idx_transactions_recorded_at ON transactions(recorded_at DESC);
