const fs = require('fs');
const path = require('path');
const { getDB } = require('../config/database');
const logger = require('../utils/logger');

const ROOT = path.resolve(process.env.AIIA_ROOT || path.join(__dirname, '../..'));
const LOG_FILE = path.join(ROOT, 'logs', 'combined.log');
const SKILLS_DIR = path.resolve(process.env.AIIA_SKILLS_DIR || path.join(ROOT, 'skills'));
const BOT_ACTIVITY_WINDOW_HOURS = 24;
const CODE_CHANGES_CACHE_MS = Number.parseInt(process.env.AIIA_CODE_CHANGES_CACHE_MS, 10) > 0
  ? Number.parseInt(process.env.AIIA_CODE_CHANGES_CACHE_MS, 10)
  : 30_000;

let recentCodeChangesCache = {
  at: 0,
  data: [],
};

function tailLines(filePath, lineCount = 20) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const stat = fs.statSync(filePath);
    const maxBytes = 64 * 1024;
    const start = Math.max(0, stat.size - maxBytes);
    const readLength = stat.size - start;
    const fd = fs.openSync(filePath, 'r');
    try {
      const buffer = Buffer.alloc(readLength);
      fs.readSync(fd, buffer, 0, readLength, start);
      return buffer.toString('utf-8').split(/\r?\n/).filter(Boolean).slice(-lineCount);
    } finally {
      fs.closeSync(fd);
    }
  } catch { return []; }
}

function parseLogStats(lines) {
  let errorCount = 0;
  let warnCount = 0;
  for (const line of lines) {
    if (/"level":"error"|\bERROR\b/i.test(line)) errorCount += 1;
    if (/"level":"warn"|\bWARN\b/i.test(line)) warnCount += 1;
  }
  return { errorCount, warnCount };
}

async function getBotCounts() {
  try {
    const db = getDB();
    const since = new Date(Date.now() - BOT_ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const row = await db.get(
      `SELECT COUNT(*) AS botCount, SUM(CASE WHEN lastSeen >= ? THEN 1 ELSE 0 END) AS activeBots24h FROM bots`,
      [since]
    );
    return { botCount: row?.botCount || 0, activeBots24h: row?.activeBots24h || 0 };
  } catch { return { botCount: 0, activeBots24h: 0 }; }
}

function getRecentCodeChanges(baseDir, maxItems = 12) {
  const out = [];
  const targetDirs = ['src', 'public'];
  const now = Date.now();
  function walk(dirPath) {
    let entries = [];
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else {
        try {
          const st = fs.statSync(full);
          out.push({
            file: full.replace(baseDir + path.sep, '').replace(/\\/g, '/'),
            mtimeMs: st.mtimeMs,
            ageSec: Math.max(0, Math.floor((now - st.mtimeMs) / 1000)),
          });
        } catch {}
      }
    }
  }
  for (const d of targetDirs) walk(path.join(baseDir, d));
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, maxItems);
}

exports.getStatus = async (req, res) => {
  let skillCount = 0;
  try {
    skillCount = fs.readdirSync(SKILLS_DIR).filter((entry) => {
      const p = path.join(SKILLS_DIR, entry);
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    }).length;
  } catch {}
  const recentEvents = tailLines(LOG_FILE, 30);
  const recentCodeChanges = getRecentCodeChanges(ROOT, 12);
  const { errorCount, warnCount } = parseLogStats(recentEvents);
  const { botCount, activeBots24h } = await getBotCounts();
  res.json({
    status: 'ok', timestamp: new Date().toISOString(), uptimeSec: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || 'development', skillCount, botCount, activeBots24h,
    errorCount, warnCount, recentEvents, recentCodeChanges,
  });
};

exports.getEvents = async (req, res) => {
  try {
    const db = getDB();
    // Fetch last 100 tasks without time filter to ensure map has data
    const tasks = await db.all(
      `SELECT t.id, t.bot_id, t.type, t.payload, t.status, t.created_at, b.name as bot_name
       FROM bot_tasks t
       JOIN bots b ON t.bot_id = b.id
       ORDER BY t.created_at DESC LIMIT 100`
    );

    // Fetch bots seen in last hour
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const bots = await db.all(`SELECT id, name, lastSeen, state FROM bots WHERE lastSeen >= ?`, [since]);

    // Get live workspace folders (Scan the project root, not system root)
    const workspaceRoot = ROOT; 
    let folders = [];
    try {
        folders = fs.readdirSync(workspaceRoot, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.') && !['node_modules', 'logs', 'bin'].includes(dirent.name))
            .map(dirent => dirent.name)
            .slice(0, 10);
    } catch (e) {}

    res.json({
      timestamp: new Date().toISOString(),
      tasks: tasks.map(t => {
          let p = {};
          try { p = JSON.parse(t.payload); } catch(e) {}
          return {...t, payload: p};
      }),
      bots,
      folders
    });
  } catch (err) {
    logger.error('Failed to fetch events: ' + err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};
