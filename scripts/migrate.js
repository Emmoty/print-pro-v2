/**
 * CloudPrint Pro - PostgreSQL Database Migration Script
 * Reads schema.sql and runs all DDL statements on the target PostgreSQL instance.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;

  if (!connectionString && !host) {
    console.warn('⚠️ No DATABASE_URL or PGHOST specified in .env. Skipping PostgreSQL migration.');
    return;
  }

  console.log('🐘 Connecting to PostgreSQL database on VPS...');
  const pool = new Pool(connectionString ? {
    connectionString,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
  } : {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'cloudprint',
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    const timeRes = await pool.query('SELECT NOW() as now, version() as version');
    console.log(`✅ Connected: ${timeRes.rows[0].version}`);
    console.log(`⏰ Server time: ${timeRes.rows[0].now}`);

    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Executing schema.sql migrations...');
    await pool.query(sql);
    console.log('🎉 PostgreSQL Schema Migration Completed Successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
