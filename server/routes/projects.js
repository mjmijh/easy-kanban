import express from 'express';
import crypto from 'crypto';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getRequestDatabase } from '../middleware/tenantRouting.js';
import { wrapQuery } from '../utils/queryLogger.js';

const router = express.Router();

// GET /api/projects — list all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getRequestDatabase(req);
    const projects = await wrapQuery(
      db.prepare('SELECT * FROM projects ORDER BY position ASC, created_at ASC'),
      'SELECT'
    ).all();
    res.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch projects' });
  }
});

// POST /api/projects — create project (admin only)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const db = getRequestDatabase(req);
    const { title, color = '#3B82F6' } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    // Get next position
    const maxPos = await wrapQuery(
      db.prepare('SELECT MAX(position) as maxPos FROM projects'),
      'SELECT'
    ).get();
    const position = (maxPos?.maxPos ?? -1) + 1;

    const id = crypto.randomUUID();
    await wrapQuery(
      db.prepare('INSERT INTO projects (id, title, color, position) VALUES (?, ?, ?, ?)'),
      'INSERT'
    ).run(id, title.trim(), color, position);

    const project = await wrapQuery(
      db.prepare('SELECT * FROM projects WHERE id = ?'),
      'SELECT'
    ).get(id);

    res.status(201).json(project);
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({ success: false, message: 'Failed to create project' });
  }
});

// PUT /api/projects/:id — update project (admin only)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const db = getRequestDatabase(req);
    const { id } = req.params;
    const { title, color } = req.body;

    const existing = await wrapQuery(
      db.prepare('SELECT * FROM projects WHERE id = ?'),
      'SELECT'
    ).get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await wrapQuery(
      db.prepare('UPDATE projects SET title = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
      'UPDATE'
    ).run(title ?? existing.title, color ?? existing.color, id);

    const updated = await wrapQuery(
      db.prepare('SELECT * FROM projects WHERE id = ?'),
      'SELECT'
    ).get(id);

    res.json(updated);
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({ success: false, message: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id — delete project (admin only)
// Boards in this project become ungrouped (project_group_id = NULL)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const db = getRequestDatabase(req);
    const { id } = req.params;

    const existing = await wrapQuery(
      db.prepare('SELECT * FROM projects WHERE id = ?'),
      'SELECT'
    ).get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Ungroup boards before deleting
    await wrapQuery(
      db.prepare('UPDATE boards SET project_group_id = NULL WHERE project_group_id = ?'),
      'UPDATE'
    ).run(id);

    await wrapQuery(
      db.prepare('DELETE FROM projects WHERE id = ?'),
      'DELETE'
    ).run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({ success: false, message: 'Failed to delete project' });
  }
});

// PATCH /api/projects/:id/reorder — reorder projects
router.patch('/:id/reorder', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const db = getRequestDatabase(req);
    const { id } = req.params;
    const { position } = req.body;

    await wrapQuery(
      db.prepare('UPDATE projects SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
      'UPDATE'
    ).run(position, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder project:', error);
    res.status(500).json({ success: false, message: 'Failed to reorder project' });
  }
});

// PATCH /api/boards/:boardId/project — assign/unassign board to project
router.patch('/boards/:boardId/project', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const db = getRequestDatabase(req);
    const { boardId } = req.params;
    const { project_group_id } = req.body; // null to unassign

    await wrapQuery(
      db.prepare('UPDATE boards SET project_group_id = ? WHERE id = ?'),
      'UPDATE'
    ).run(project_group_id ?? null, boardId);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to assign board to project:', error);
    res.status(500).json({ success: false, message: 'Failed to assign board to project' });
  }
});

export default router;
