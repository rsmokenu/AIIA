const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  try {
    await db.run('ALTER TABLE bots ADD COLUMN state TEXT DEFAULT "active"');
    console.log('Added state column to bots table.');
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
        console.log('State column already exists.');
    } else {
        console.error('Migration error:', err.message);
    }
  }

  await db.close();
})();
