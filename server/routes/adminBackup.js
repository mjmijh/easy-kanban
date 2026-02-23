import express from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getDbPath } from '../config/database.js';
import { getRequestDatabase } from '../middleware/tenantRouting.js';

const router = express.Router();

const getDataDirs = () => {
  const base = process.env.DOCKER_ENV === 'true' ? '/app/server' : path.join(process.cwd(), 'server');
  return {
    avatars: path.join(base, 'avatars'),
    attachments: path.join(base, 'attachments')
  };
};

// Simple TAR entry builder (ustar format) — no external dependencies
function createTarEntry(filename, content) {
  const header = Buffer.alloc(512);
  Buffer.from(filename).copy(header, 0);
  Buffer.from('0000755\0').copy(header, 100);
  Buffer.from('0000000\0').copy(header, 108);
  Buffer.from('0000000\0').copy(header, 116);
  Buffer.from(content.length.toString(8).padStart(11, '0') + '\0').copy(header, 124);
  Buffer.from('00000000000\0').copy(header, 136);
  Buffer.from('0').copy(header, 156);
  Buffer.from('ustar  \0').copy(header, 257);
  // Checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) checksum += header[i];
  Buffer.from(checksum.toString(8).padStart(6, '0') + '\0 ').copy(header, 148);
  const padded = Buffer.alloc(Math.ceil(content.length / 512) * 512);
  content.copy(padded);
  return Buffer.concat([header, padded]);
}

// GET /api/admin/backup/download — full backup as .tar.gz
router.get('/download', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const db = getRequestDatabase(req);
    const tenantId = req.tenantId || null;
    const dbPath = getDbPath(tenantId);
    const { avatars: avatarsDir, attachments: attachmentsDir } = getDataDirs();

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, message: 'Database file not found' });
    }

    try { db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run(); } catch (e) {
      console.warn('WAL checkpoint warning:', e.message);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `kanban-backup-${timestamp}.tar.gz`;

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const gzip = zlib.createGzip();
    gzip.pipe(res);

    const addFile = (tarPath, filePath) => {
      if (!fs.existsSync(filePath)) return;
      gzip.write(createTarEntry(tarPath, fs.readFileSync(filePath)));
    };

    const addDir = (tarPrefix, dirPath) => {
      if (!fs.existsSync(dirPath)) return;
      for (const file of fs.readdirSync(dirPath)) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isFile()) addFile(`${tarPrefix}/${file}`, fullPath);
      }
    };

    addFile('db/kanban.db', dbPath);
    addDir('avatars', avatarsDir);
    addDir('attachments', attachmentsDir);

    gzip.write(Buffer.alloc(1024)); // end-of-archive
    gzip.end();

  } catch (error) {
    console.error('Backup download error:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Failed to create backup' });
  }
});

// GET /api/admin/backup/info
router.get('/info', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const tenantId = req.tenantId || null;
    const dbPath = getDbPath(tenantId);
    const { avatars: avatarsDir, attachments: attachmentsDir } = getDataDirs();

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, message: 'Database file not found' });
    }

    const countFiles = (dir) => {
      if (!fs.existsSync(dir)) return 0;
      return fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile()).length;
    };

    const stats = fs.statSync(dbPath);
    res.json({
      success: true,
      size: stats.size,
      lastModified: stats.mtime,
      path: path.basename(dbPath),
      avatarCount: countFiles(avatarsDir),
      attachmentCount: countFiles(attachmentsDir)
    });
  } catch (error) {
    console.error('Backup info error:', error);
    res.status(500).json({ success: false, message: 'Failed to get database info' });
  }
});

// POST /api/admin/backup/restore — accepts .tar.gz (full) or .db (legacy)
router.post('/restore', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const tenantId = req.tenantId || null;
    const dbPath = getDbPath(tenantId);
    const { avatars: avatarsDir, attachments: attachmentsDir } = getDataDirs();

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    await new Promise((resolve, reject) => { req.on('end', resolve); req.on('error', reject); });
    const fileBuffer = Buffer.concat(chunks);

    if (fileBuffer.length < 16) {
      return res.status(400).json({ success: false, message: 'Invalid backup file: too small' });
    }

    const isGzip = fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b;
    const isSQLite = fileBuffer.slice(0, 6).toString('ascii') === 'SQLite';

    if (!isGzip && !isSQLite) {
      return res.status(400).json({ success: false, message: 'Invalid file: must be .tar.gz or .db' });
    }

    // Backup current DB
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, `${dbPath}.pre_restore_backup`);

    if (isSQLite) {
      // Legacy .db restore
      fs.writeFileSync(dbPath, fileBuffer);
      for (const ext of ['-wal', '-shm']) {
        const p = dbPath + ext;
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      return res.json({
        success: true,
        message: 'Database restored (legacy .db format). Avatars and attachments were not included. Please restart the container.',
        restored: { db: true, avatars: 0, attachments: 0 }
      });
    }

    // Full tar.gz restore
    const tarBuffer = await new Promise((resolve, reject) => {
      zlib.gunzip(fileBuffer, (err, result) => err ? reject(err) : resolve(result));
    });

    // Parse tar entries
    const entries = [];
    let offset = 0;
    while (offset + 512 <= tarBuffer.length) {
      const header = tarBuffer.slice(offset, offset + 512);
      if (header.every(b => b === 0)) break;
      const name = header.slice(0, 100).toString('utf8').replace(/\0/g, '');
      const size = parseInt(header.slice(124, 135).toString('utf8').replace(/\0/g, '').trim(), 8) || 0;
      if (name && size > 0) {
        entries.push({ name, content: tarBuffer.slice(offset + 512, offset + 512 + size) });
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }

    if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
    if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });

    let dbRestored = false, avatarsRestored = 0, attachmentsRestored = 0;

    for (const entry of entries) {
      if (entry.name.startsWith('db/')) {
        fs.writeFileSync(dbPath, entry.content);
        for (const ext of ['-wal', '-shm']) {
          const p = dbPath + ext;
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        dbRestored = true;
      } else if (entry.name.startsWith('avatars/')) {
        fs.writeFileSync(path.join(avatarsDir, path.basename(entry.name)), entry.content);
        avatarsRestored++;
      } else if (entry.name.startsWith('attachments/')) {
        fs.writeFileSync(path.join(attachmentsDir, path.basename(entry.name)), entry.content);
        attachmentsRestored++;
      }
    }

    if (!dbRestored) {
      return res.status(400).json({ success: false, message: 'No database found in backup archive' });
    }

    console.log(`✅ Full restore: DB + ${avatarsRestored} avatars + ${attachmentsRestored} attachments`);
    res.json({
      success: true,
      message: `Restore complete. DB, ${avatarsRestored} avatar(s) and ${attachmentsRestored} attachment(s) restored. Please restart the container.`,
      restored: { db: true, avatars: avatarsRestored, attachments: attachmentsRestored }
    });

  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ success: false, message: `Restore failed: ${error.message}` });
  }
});

export default router;
