/**
 * CloudPrint Pro - Database Disaster Recovery & Restoration Verification Utility
 */

const fs = require('fs');
const path = require('path');
const db = require('../lib/db');

const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');

function restoreLatestBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    throw new Error('Backup directory does not exist.');
  }

  const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup_')).sort();
  if (backups.length === 0) {
    throw new Error('No database backups available for restoration.');
  }

  const latestBackup = backups[backups.length - 1];
  const backupPath = path.join(BACKUP_DIR, latestBackup);
  const raw = fs.readFileSync(backupPath, 'utf8');
  const snapshot = JSON.parse(raw);

  const success = db.importSnapshot(snapshot);
  if (!success) throw new Error('Snapshot format invalid');

  console.log(`✅ Database Restored Successfully from: ${latestBackup}`);
  console.log(`📊 Restored State: ${snapshot.users.length} Users, ${snapshot.orders.length} Orders, ${snapshot.audit_logs.length} Audit Logs`);
  return true;
}

if (require.main === module) {
  restoreLatestBackup();
}

module.exports = restoreLatestBackup;
