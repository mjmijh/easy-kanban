import express from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getDbPath } from '../config/database.js';
import { getRequestDatabase } from '../middleware/tenantRouting.js';

const router = express.Router();

// GET /api/admin/backup/download
// Download the SQLite database file as a backup
router.get('/download', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const db = getRequestDatabase(req);
    const tenantId = req.tenantId || null;
    const dbPath = getDbPath(tenantId);

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, message: 'Database file not found' });
    }

    // Run a WAL checkpoint to ensure all data is flushed to the main DB file
    try {
      db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
    } catch (e) {
      // Non-fatal - continue with download even if checkpoint fails
      console.warn('WAL checkpoint warning:', e.message);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `kanban-backup-${timestamp}.db`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fs.statSync(dbPath).size);

    const readStream = fs.createReadStream(dbPath);
    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('Error streaming backup file:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error reading database file' });
      }
    });

  } catch (error) {
    console.error('Backup download error:', error);
    res.status(500).json({ success: false, message: 'Failed to create backup' });
  }
});

// GET /api/admin/backup/info
// Return info about the current database (size, last modified)
router.get('/info', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const tenantId = req.tenantId || null;
    const dbPath = getDbPath(tenantId);

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, message: 'Database file not found' });
    }

    const stats = fs.statSync(dbPath);
    res.json({
      success: true,
      size: stats.size,
      lastModified: stats.mtime,
      path: path.basename(dbPath)
    });
  } catch (error) {
    console.error('Backup info error:', error);
    res.status(500).json({ success: false, message: 'Failed to get database info' });
  }
});

// POST /api/admin/backup/restore
// Upload and restore a SQLite database backup
router.post('/restore', authenticateToken, requireRole(['admin']), async (req, res) => {
  let tempPath = null;

  try {
    const tenantId = req.tenantId || null;
    const dbPath = getDbPath(tenantId);

    // Read uploaded file from raw body (sent as binary)
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));

    await new Promise((resolve, reject) => {
      req.on('end', resolve);
      req.on('error', reject);
    });

    const fileBuffer = Buffer.concat(chunks);

    // Validate it's a SQLite file (magic bytes: 53 51 4C 69 74 65 = "SQLite")
    if (fileBuffer.length < 16) {
      return res.status(400).json({ success: false, message: 'Invalid backup file: too small' });
    }

    const magic = fileBuffer.slice(0, 6).toString('ascii');
    if (magic !== 'SQLite') {
      return res.status(400).json({ success: false, message: 'Invalid backup file: not a SQLite database' });
    }

    // Write to temp file first
    tempPath = `${dbPath}.restore_tmp`;
    fs.writeFileSync(tempPath, fileBuffer);

    // Create a backup of the current DB before overwriting
    const backupPath = `${dbPath}.pre_restore_backup`;
    fs.copyFileSync(dbPath, backupPath);

    // Replace the current DB with the restored one
    fs.copyFileSync(tempPath, dbPath);
    fs.unlinkSync(tempPath);

    // Clean up WAL and SHM files if they exist (they belong to the old DB)
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    console.log(`✅ Database restored successfully. Previous DB saved as ${path.basename(backupPath)}`);

    res.json({
      success: true,
      message: 'Database restored successfully. Please restart the Docker container to apply changes.',
      size: fileBuffer.length
    });

  } catch (error) {
    console.error('Restore error:', error);

    // Cleanup temp file if it exists
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }

    res.status(500).json({ success: false, message: `Restore failed: ${error.message}` });
  }
});

export default router;
