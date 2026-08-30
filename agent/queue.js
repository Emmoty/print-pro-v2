/**
 * ==============================================================================
 * CloudPrint Pro - Persistent Transactional Print Job Queue
 * ==============================================================================
 * Crash-Resilient State Machine with Zero Duplicate Print Guarantee
 * 
 * States:
 *   QUEUED -> DOWNLOADING -> VALIDATING -> CONVERTING ->
 *   READY_TO_PRINT -> PRINTING -> SUBMITTED_TO_SPOOLER -> COMPLETED
 *   (or FAILED / WAITING_FOR_PRINTER / PRINT_STATUS_UNKNOWN)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');

class PersistentJobQueue {
  constructor() {
    this.jobs = new Map();
    this.completedIds = new Set();
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(QUEUE_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        if (Array.isArray(raw.jobs)) {
          raw.jobs.forEach(j => this.jobs.set(j.id, j));
        }
        if (Array.isArray(raw.completedIds)) {
          raw.completedIds.forEach(id => this.completedIds.add(id));
        }
      } catch (e) {
        console.warn('⚠️ [QUEUE] Warning parsing queue.json, initializing fresh queue state.');
      }
    }
  }

  save() {
    try {
      const payload = {
        updatedAt: new Date().toISOString(),
        jobs: Array.from(this.jobs.values()),
        completedIds: Array.from(this.completedIds)
      };

      const tmpFile = `${QUEUE_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpFile, QUEUE_FILE);
    } catch (e) {
      console.error('❌ [QUEUE] Failed to commit queue state to disk:', e.message);
    }
  }

  /**
   * Checks if job was already successfully printed (Duplicate Print Defense)
   */
  isDuplicate(jobId) {
    if (!jobId) return false;
    if (this.completedIds.has(jobId)) return true;

    const existing = this.jobs.get(jobId);
    if (existing && (existing.status === 'COMPLETED' || existing.status === 'SUBMITTED_TO_SPOOLER' || existing.status === 'PRINT_STATUS_UNKNOWN')) {
      return true;
    }

    return false;
  }

  /**
   * Enqueues a new authorized print job
   */
  enqueue(job) {
    if (this.isDuplicate(job.id)) {
      console.warn(`🛡️ [DUPLICATE GUARD] Job ${job.id} already completed or spooled. Refusing duplicate print.`);
      return null;
    }

    const jobRecord = {
      id: job.id,
      fileName: job.fileName || 'document.pdf',
      files: job.files || [],
      paperSize: (job.paperSize || 'a4').toLowerCase(),
      colorMode: (job.colorMode || 'bw').toLowerCase(),
      copies: Math.max(1, parseInt(job.copies, 10) || 1),
      pages: Math.max(1, parseInt(job.pages, 10) || 1),
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retries: 0,
      error: null
    };

    this.jobs.set(job.id, jobRecord);
    this.save();
    return jobRecord;
  }

  /**
   * Updates state of an active job
   */
  updateStatus(jobId, status, meta = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    job.status = status;
    job.updatedAt = new Date().toISOString();

    if (meta.error) job.error = meta.error;
    if (meta.printer) job.printer = meta.printer;
    if (meta.filePath) job.filePath = meta.filePath;

    if (status === 'COMPLETED') {
      this.completedIds.add(jobId);
    }

    this.save();
    return job;
  }

  /**
   * Retrieves next pending job ready to print
   */
  getNextPendingJob() {
    for (const job of this.jobs.values()) {
      if (job.status === 'QUEUED' || job.status === 'READY_TO_PRINT') {
        return job;
      }
    }
    return null;
  }

  /**
   * Gets job by ID
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Returns list of all queue items
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Prunes historical jobs older than retention window (default 24h)
   */
  prune(maxAgeMs = 86400000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        const t = new Date(job.updatedAt).getTime();
        if (t < cutoff) {
          this.jobs.delete(id);
        }
      }
    }
    this.save();
  }
}

module.exports = new PersistentJobQueue();
