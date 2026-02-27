const { randomUUID } = require('crypto');
const { getDB } = require('../config/database');
const logger = require('../utils/logger');
const llmService = require('../services/llmService');

function parseCapabilities(v) { 
    const i = Array.isArray(v) ? v : (typeof v === 'string' ? [v] : []);
    return Array.from(new Set(i.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 80))));
}
function parseCapabilitiesFromDb(r) { try { const p = JSON.parse(r || '[]'); return Array.isArray(p) ? p : []; } catch { return []; } }
function parseMetadataSafe(r) { try { return JSON.parse(r || '{}'); } catch { return {}; } }

exports.handshake = async (req, res) => {
  const { botName, capabilities, version, botId } = req.body;
  if (!botName) return res.status(400).json({ error: 'Requires botName' });

  const db = getDB();
  const now = new Date().toISOString();
  const caps = JSON.stringify(parseCapabilities(capabilities));

  try {
    // If botId provided, prioritize updating by ID (allows persist after Rename)
    if (botId) {
        const existing = await db.get('SELECT id FROM bots WHERE id = ?', [botId]);
        if (existing) {
            await db.run('UPDATE bots SET capabilities = ?, lastSeen = ? WHERE id = ?', [caps, now, botId]);
            return res.json({ botId, message: 'Heartbeat updated' });
        }
    }

    // Fallback to name search
    const existingByName = await db.get('SELECT id FROM bots WHERE name = ? ORDER BY lastSeen DESC LIMIT 1', [botName]);
    if (existingByName) {
        await db.run('UPDATE bots SET capabilities = ?, lastSeen = ? WHERE id = ?', [caps, now, existingByName.id]);
        return res.json({ botId: existingByName.id, message: 'Welcome back' });
    }

    const newId = botId || `bot_${randomUUID()}`;
    await db.run('INSERT INTO bots (id, name, capabilities, version, lastSeen) VALUES (?, ?, ?, ?, ?)', [newId, botName, caps, version, now]);
    res.json({ botId: newId, message: 'Registered' });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
};

exports.getBrainStatus = (req, res) => {
    res.json({ configured: !!llmService.genAI, mode: !!llmService.genAI ? 'REAL (Gemini 2.0)' : 'SIMULATION' });
};

exports.listBots = async (req, res) => {
  try {
    const db = getDB();
    const bots = await db.all('SELECT * FROM bots ORDER BY lastSeen DESC LIMIT 100');
    res.json({ data: bots.map(b => ({ ...b, capabilities: parseCapabilitiesFromDb(b.capabilities) })) });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
};

exports.assignTask = async (req, res) => {
  const { id } = req.params;
  const { type = 'direct_prompt', content, targetBotId } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const db = getDB();
  try {
    const bot = await db.get('SELECT name, state, capabilities FROM bots WHERE id = ?', [id]);
    if (!bot) return res.status(404).json({ error: 'Not found' });
    if (bot.state === 'paused') return res.status(403).json({ error: 'Paused' });

    let final = content.trim();
    if (type === 'direct_prompt') {
        const caps = parseCapabilitiesFromDb(bot.capabilities);
        const prompt = `System: You are an AIIA Task Orchestrator. Translate: "${final}" into a command for an agent with: [${caps.join(', ')}]. 
        CRITICAL: Return ONLY the raw shell command (CMD/PS5/Bash). No explanation. No markdown. Use "curl" for API tasks.`;
        try {
            const translation = await llmService.getCompletion(prompt, { useCache: true });
            final = translation.content.replace(/```[a-z]*\n?|```/gi, '').trim();
        } catch (e) {}
    }

    const taskId = `task_${randomUUID()}`;
    await db.run('INSERT INTO bot_tasks (id, bot_id, type, payload, status, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [taskId, id, type, JSON.stringify({ content: final, originalPrompt: content.trim(), targetBotId }), 'queued', new Date().toISOString(), 0]);
    res.json({ taskId, status: 'queued', content: final });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
};

exports.listTasks = async (req, res) => {
  const { id } = req.params;
  const db = getDB();
  try {
    const tasks = await db.all('SELECT * FROM bot_tasks WHERE bot_id = ? AND status = "queued" ORDER BY priority DESC, created_at ASC LIMIT 5', [id]);
    if (tasks.length > 0) {
        await db.run(`UPDATE bot_tasks SET status = "delivered" WHERE id IN (${tasks.map(() => '?').join(',')})`, tasks.map(t => t.id));
    }
    res.json({ data: tasks.map(t => ({...t, payload: parseMetadataSafe(t.payload)})) });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
};

exports.getTaskHistory = async (req, res) => {
    try {
        const tasks = await getDB().all('SELECT * FROM bot_tasks WHERE bot_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.id]);
        res.json({ data: tasks.map(t => ({...t, payload: parseMetadataSafe(t.payload)})) });
    } catch (err) { res.status(500).json({ error: 'DB Error' }); }
};

exports.removeTask = async (req, res) => {
    try { await getDB().run('DELETE FROM bot_tasks WHERE id = ?', [req.params.taskId]); res.json({ message: 'OK' }); } catch (e) { res.status(500).json({ error: 'DB Error' }); }
};

exports.updateTaskPriority = async (req, res) => {
    const { taskId, direction } = req.params;
    const delta = direction === 'up' ? 100 : -10;
    try {
        await getDB().run('UPDATE bot_tasks SET priority = priority + ?, status = "queued" WHERE id = ?', [delta, taskId]);
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ error: 'DB Error' }); }
};

exports.completeTask = async (req, res) => {
    const { taskId } = req.params;
    const { result } = req.body;
    try {
        const t = await getDB().get('SELECT payload FROM bot_tasks WHERE id = ?', [taskId]);
        const p = parseMetadataSafe(t?.payload);
        p.result = result; p.completed_at = new Date().toISOString();
        await getDB().run('UPDATE bot_tasks SET status = "completed", payload = ? WHERE id = ?', [JSON.stringify(p), taskId]);
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ error: 'DB Error' }); }
};

exports.updateState = async (req, res) => {
    const s = req.params.action === 'resume' ? 'active' : 'paused';
    try { await getDB().run('UPDATE bots SET state = ? WHERE id = ?', [s, req.params.id]); res.json({ message: 'OK' }); } catch (e) { res.status(500).json({ error: 'DB Error' }); }
};

exports.removeBot = async (req, res) => {
    try {
        await getDB().run('DELETE FROM bot_tasks WHERE bot_id = ?', [req.params.id]);
        await getDB().run('DELETE FROM bots WHERE id = ?', [req.params.id]);
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ error: 'DB Error' }); }
};

exports.renameBot = async (req, res) => {
    try { await getDB().run('UPDATE bots SET name = ? WHERE id = ?', [req.body.newName, req.params.id]); res.json({ message: 'OK' }); } catch (e) { res.status(500).json({ error: 'DB Error' }); }
};

exports.broadcast = async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const db = getDB();
    try {
        const sender = await db.get('SELECT name FROM bots WHERE id = ?', [id]);
        const targets = await db.all('SELECT id FROM bots WHERE id != ? AND state = "active"', [id]);
        for (const t of targets) {
            const p = JSON.stringify({ content, originalPrompt: `Broadcast from ${sender.name}: ${content}` });
            await db.run('INSERT INTO bot_tasks (id, bot_id, type, payload, status, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                [`task_${randomUUID()}`, t.id, 'direct_prompt', p, 'queued', new Date().toISOString(), 10]);
        }
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ error: 'DB Error' }); }
};
