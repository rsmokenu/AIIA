const { randomUUID } = require('crypto');
const { getDB } = require('../config/database');
const logger = require('../utils/logger');

function parseMetadataSafe(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function serializeMetadataSafe(metadata) {
  try {
    return JSON.stringify(metadata ?? {});
  } catch {
    return JSON.stringify({ note: 'metadata_unserializable' });
  }
}

function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

exports.requestApproval = async (action, metadata) => {
  const normalizedAction = typeof action === 'string' ? action.trim().slice(0, 120) : '';
  if (!normalizedAction) {
    throw new Error('Approval action must be a non-empty string');
  }

  const id = randomUUID();
  const db = getDB();
  try {
    await db.run(
      'INSERT INTO approvals (id, action, metadata, timestamp) VALUES (?, ?, ?, ?)',
      [id, normalizedAction, serializeMetadataSafe(metadata), new Date().toISOString()]
    );
    return id;
  } catch (err) {
    logger.error(`Failed to record approval request: ${err.message}`);
    throw err;
  }
};

exports.listPending = async (req, res) => {
  try {
    const requested = Number.parseInt(req.query?.limit, 10);
    const limit = Number.isFinite(requested) ? Math.min(500, Math.max(1, requested)) : 100;

    const db = getDB();
    const list = await db.all(
      "SELECT * FROM approvals WHERE status = 'pending' ORDER BY timestamp DESC LIMIT ?",
      [limit]
    );
    res.json({ data: list.map((a) => ({ ...a, metadata: parseMetadataSafe(a.metadata) })), limit });
  } catch (err) {
    logger.error(`Failed to list pending approvals: ${err.message}`);
    res.status(500).json({ error: 'Database error' });
  }
};

async function applyApprovalDecision(id, nextStatus, successMessage, res) {
  const db = getDB();

  try {
    const result = await db.run(
      'UPDATE approvals SET status = ? WHERE id = ? AND status = ?',
      [nextStatus, id, 'pending']
    );

    if (result.changes > 0) {
      return res.json({ message: successMessage });
    }

    const existing = await db.get('SELECT status FROM approvals WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }

    return res.status(409).json({
      error: `Request already resolved as ${existing.status}`,
      status: existing.status,
    });
  } catch (err) {
    logger.error(`Failed to update approval ${id}: ${err.message}`);
    return res.status(500).json({ error: 'Update failed' });
  }
}

exports.approve = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: 'Invalid approval id format' });
  return applyApprovalDecision(id, 'approved', 'Action approved', res);
};

exports.deny = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: 'Invalid approval id format' });
  return applyApprovalDecision(id, 'denied', 'Action denied', res);
};
