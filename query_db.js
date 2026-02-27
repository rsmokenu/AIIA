const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  const bots = await db.all('SELECT * FROM bots ORDER BY lastSeen DESC LIMIT 5');
  const tasks = await db.all('SELECT * FROM bot_tasks ORDER BY created_at DESC LIMIT 10');

  console.log('--- RECENT BOTS ---');
  console.table(bots);
  console.log('--- RECENT TASKS ---');
  console.table(tasks);

  await db.close();
})();
