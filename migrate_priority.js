const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  try {
    await db.run('ALTER TABLE bot_tasks ADD COLUMN priority INTEGER DEFAULT 0');
    console.log('Added priority column to bot_tasks table.');
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
        console.log('Priority column already exists.');
    } else {
        console.error('Migration error:', err.message);
    }
  }

  await db.close();
})();
