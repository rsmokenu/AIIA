const { randomUUID } = require('crypto');
const { getDB } = require('../config/database');
const logger = require('../utils/logger');
const llmService = require('../services/llmService');

function parseCapabilities(value) {
  const input = Array.isArray(value)
    ? value
    : (typeof value === 'string' ? [value] : []);

  const normalized = input
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 80));

  return Array.from(new Set(normalized));
}

function parseCapabilitiesFromDb(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseMetadataSafe(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

exports.handshake = async (req, res) => {
  const payload = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
  const { botName, capabilities, version } = payload;

  if (typeof botName !== 'string' || !botName.trim()) {
    return res.status(400).json({ error: 'Handshake requires non-empty string "botName"' });
  }

  const normalizedBotName = botName.trim().slice(0, 120);
  const normalizedCapabilities = parseCapabilities(capabilities).slice(0, 100);
  const normalizedVersion = typeof version === 'string' ? version.trim().slice(0, 64) : null;

  const db = getDB();
  const nowIso = new Date().toISOString();

  try {
    const existing = await db.get(
      'SELECT id FROM bots WHERE name = ? ORDER BY lastSeen DESC LIMIT 1',
      [normalizedBotName]
    );

    if (existing?.id) {
      await db.run(
        'UPDATE bots SET capabilities = ?, version = ?, lastSeen = ? WHERE id = ?',
        [JSON.stringify(normalizedCapabilities), normalizedVersion, nowIso, existing.id]
      );

      logger.info(`Bot heartbeat updated: ${normalizedBotName} (${existing.id})`);
      return res.json({ botId: existing.id, message: `Welcome back ${normalizedBotName}` });
    }

    const botId = `bot_${randomUUID()}`;
    await db.run(
      'INSERT INTO bots (id, name, capabilities, version, lastSeen) VALUES (?, ?, ?, ?, ?)',
      [botId, normalizedBotName, JSON.stringify(normalizedCapabilities), normalizedVersion, nowIso]
    );
    logger.info(`New bot registered in DB: ${normalizedBotName} (${botId})`);
    return res.json({ botId, message: `Welcome ${normalizedBotName}` });
  } catch (err) {
    logger.error(`Database error during handshake: ${err.message}`);
    return res.status(500).json({ error: 'Persistence failure' });
  }
};

exports.listBots = async (req, res) => {
  try {
    const requested = Number.parseInt(req.query?.limit, 10);
    const limit = Number.isFinite(requested) ? Math.min(500, Math.max(1, requested)) : 100;

    const db = getDB();
    const bots = await db.all('SELECT * FROM bots ORDER BY lastSeen DESC LIMIT ?', [limit]);
    res.json({
      data: bots.map((b) => ({ ...b, capabilities: parseCapabilitiesFromDb(b.capabilities) })),
      limit,
    });
  } catch (err) {
    logger.error(`Failed to fetch bot registry: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch registry' });
  }
};

exports.assignTask = async (req, res) => {
  const { id } = req.params;
  const payload = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
  const { type = 'direct_prompt', content, targetBotId } = payload;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Task content (string) is required.' });
  }

  const taskId = `task_${randomUUID()}`;
  const db = getDB();
  const nowIso = new Date().toISOString();

  try {
    const bot = await db.get('SELECT id, name, state, capabilities FROM bots WHERE id = ?', [id]);
    if (!bot) return res.status(404).json({ error: 'Target bot not found.' });
    if (bot.state === 'paused') return res.status(403).json({ error: `Agent ${bot.name} is paused.` });

    let finalContent = content.trim();
    
    // NLP Translation for direct prompts
    if (type === 'direct_prompt') {
        const capabilities = parseCapabilitiesFromDb(bot.capabilities);
        const nlpPrompt = `System: You are an AIIA Task Orchestrator. 
Translate this natural language request: "${finalContent}" 
into a precise technical command for an agent with these capabilities: [${capabilities.join(', ')}].
If it's a shell command, return ONLY the command string (e.g. "ls -la" or "Restart-Computer").
Return ONLY the formatted command, no explanation. Do not wrap in markdown.`;
        
        try {
            const translation = await llmService.getCompletion(nlpPrompt, { useCache: true });
            finalContent = translation.content.replace(/```[a-z]*\n?|```/gi, '').trim();
            logger.info(`NLP Translated [${content}] -> [${finalContent}] for ${bot.name}`);
        } catch (err) {
            logger.warn(`NLP Translation failed, using raw content: ${err.message}`);
        }
    }

    const taskPayload = JSON.stringify({
      content: finalContent,
      originalPrompt: content.trim(),
      targetBotId: targetBotId || null,
    });

    await db.run(
      'INSERT INTO bot_tasks (id, bot_id, type, payload, status, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [taskId, id, type, taskPayload, 'queued', nowIso, 0]
    );

    res.json({ taskId, status: 'queued', content: finalContent });
  } catch (err) {
    logger.error(`Failed to assign task: ${err.message}`);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.listTasks = async (req, res) => {
  const { id } = req.params;
  const db = getDB();
  try {
    const bot = await db.get('SELECT state FROM bots WHERE id = ?', [id]);
    if (!bot || bot.state === 'paused') return res.json({ data: [] });

    const tasks = await db.all(
        'SELECT * FROM bot_tasks WHERE bot_id = ? AND status = "queued" ORDER BY priority DESC, created_at ASC LIMIT 20', 
        [id]
    );
    
    if (tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);
        const placeholders = taskIds.map(() => '?').join(',');
        await db.run(`UPDATE bot_tasks SET status = "delivered" WHERE id IN (${placeholders})`, taskIds);
    }

    res.json({ data: tasks.map(t => ({...t, payload: parseMetadataSafe(t.payload)})) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.getTaskHistory = async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    try {
        const tasks = await db.all(
            'SELECT * FROM bot_tasks WHERE bot_id = ? ORDER BY status DESC, priority DESC, created_at DESC LIMIT 50', 
            [id]
        );
        res.json({ data: tasks.map(t => ({...t, payload: parseMetadataSafe(t.payload)})) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};

exports.removeTask = async (req, res) => {
    const { taskId } = req.params;
    const db = getDB();
    try {
        await db.run('DELETE FROM bot_tasks WHERE id = ?', [taskId]);
        res.json({ message: 'Task removed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove task' });
    }
};

exports.updateTaskPriority = async (req, res) => {
    const { taskId, direction } = req.params;
    const db = getDB();
    try {
        const delta = direction === 'up' ? 1 : -1;
        await db.run('UPDATE bot_tasks SET priority = priority + ? WHERE id = ?', [delta, taskId]);
        res.json({ message: 'Priority updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update priority' });
    }
};

exports.completeTask = async (req, res) => {
    const { taskId } = req.params;
    const { result } = req.body;
    const db = getDB();
    try {
        const t = await db.get('SELECT payload FROM bot_tasks WHERE id = ?', [taskId]);
        if (!t) return res.status(404).json({ error: 'Task not found' });
        
        const payload = parseMetadataSafe(t.payload);
        payload.result = result;
        payload.completed_at = new Date().toISOString();

        await db.run(
            'UPDATE bot_tasks SET status = "completed", payload = ? WHERE id = ?',
            [JSON.stringify(payload), taskId]
        );
        res.json({ message: 'Task marked as completed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to complete task' });
    }
};

exports.updateState = async (req, res) => {
    const { id, action } = req.params;
    const newState = action === 'resume' ? 'active' : 'paused';
    const db = getDB();
    try {
        const result = await db.run('UPDATE bots SET state = ? WHERE id = ?', [newState, id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Bot not found' });
        res.json({ message: `Bot ${newState}` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update bot state' });
    }
};

exports.removeBot = async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    try {
        await db.run('DELETE FROM bot_tasks WHERE bot_id = ?', [id]);
        const result = await db.run('DELETE FROM bots WHERE id = ?', [id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Bot not found' });
        res.json({ message: 'Bot removed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove bot' });
    }
};

exports.renameBot = async (req, res) => {
    const { id } = req.params;
    const { newName } = req.body;
    
    if (!newName || typeof newName !== 'string' || !newName.trim()) {
        return res.status(400).json({ error: 'New name must be a non-empty string' });
    }

    const db = getDB();
    try {
        const result = await db.run('UPDATE bots SET name = ? WHERE id = ?', [newName.trim(), id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Bot not found' });
        logger.info(`Bot ${id} renamed to ${newName}`);
        res.json({ message: 'Bot renamed successfully', newName });
    } catch (err) {
        res.status(500).json({ error: 'Failed to rename bot' });
    }
};

exports.broadcast = async (req, res) => {
    const { id } = req.params; // Sender ID
    const { content, type = 'direct_prompt' } = req.body;
    
    if (!content) return res.status(400).json({ error: 'Content required' });

    const db = getDB();
    const nowIso = new Date().toISOString();

    try {
        const sender = await db.get('SELECT name FROM bots WHERE id = ?', [id]);
        if (!sender) return res.status(404).json({ error: 'Sender bot not found' });

        const targets = await db.all('SELECT id FROM bots WHERE id != ? AND state = "active"', [id]);
        
        for (const t of targets) {
            const taskId = `task_${randomUUID()}`;
            const payload = JSON.stringify({
                content: content,
                originalPrompt: `Broadcast from ${sender.name}: ${content}`,
                senderId: id
            });
            await db.run(
                'INSERT INTO bot_tasks (id, bot_id, type, payload, status, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [taskId, t.id, type, payload, 'queued', nowIso, 1] // Higher priority for broadcasts
            );
        }
        
        res.json({ message: `Broadcast sent to ${targets.length} agents` });
    } catch (err) {
        res.status(500).json({ error: 'Broadcast failed' });
    }
};
