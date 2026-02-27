const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const logger = require('../utils/logger');

let db;

async function initDB() {
  if (db) return db;

  db = await open({
    filename: path.join(__dirname, '../../database.sqlite'),
    driver: sqlite3.Database
  });

  logger.info('Connected to the AIIA SQLite database.');

  // SQLite reliability + concurrency tuning
  await db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  // Initialize Tables + useful indexes
  await db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capabilities TEXT,
      version TEXT,
      lastSeen DATETIME,
      state TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      metadata TEXT,
      status TEXT DEFAULT 'pending',
      timestamp DATETIME
    );

    CREATE TABLE IF NOT EXISTS prompt_cache (
      prompt_hash TEXT PRIMARY KEY,
      response TEXT,
      timestamp DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_bots_name_lastSeen ON bots(name, lastSeen DESC);
    CREATE INDEX IF NOT EXISTS idx_bots_lastSeen ON bots(lastSeen DESC);
    CREATE INDEX IF NOT EXISTS idx_approvals_status_timestamp ON approvals(status, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_prompt_cache_timestamp ON prompt_cache(timestamp DESC);

    CREATE TABLE IF NOT EXISTS bot_tasks (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      status TEXT DEFAULT 'queued',
      created_at DATETIME,
      priority INTEGER DEFAULT 0,
      FOREIGN KEY(bot_id) REFERENCES bots(id)
    );
    CREATE INDEX IF NOT EXISTS idx_bot_tasks_bot_id ON bot_tasks(bot_id, status);
  `);

  return db;
}

async function closeDB() {
  if (!db) return;
  await db.close();
  db = null;
  logger.info('Closed AIIA SQLite database connection.');
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

module.exports = {
  getDB,
  initDB,
  closeDB,
};
