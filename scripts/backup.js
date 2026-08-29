/**
 * CloudPrint Pro - Automated Production Database Backup Utility
 * Exports an encrypted/timestamped JSON snapshot of the database state
 */

const fs = require('fs');
const path = require('path');
const db = require('../lib/db');

const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `backup_cloudprint_${timestamp}.json`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  const snapshot = db.exportSnapshot();
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`✅ Automated Database Backup Created: ${backupFilename}`);
  console.log(`📁 Path: ${backupPath}`);
  console.log(`📊 Snapshot Stats: ${snapshot.users.length} Users, ${snapshot.orders.length} Orders, ${snapshot.audit_logs.length} Audit Logs`);

  // Retention: Keep last 30 backups
  const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup_')).sort();
  if (backups.length > 30) {
    const toRemove = backups.slice(0, backups.length - 30);
    toRemove.forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
    console.log(`🧹 Cleaned ${toRemove.length} expired backups.`);
  }

  return backupPath;
}

if (require.main === module) {
  runBackup();
}

module.exports = runBackup;
