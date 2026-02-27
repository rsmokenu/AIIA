const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  const botId = 'bot_ec9220ff-610d-4e9b-8931-cd9a2d75bbd5';
  await db.run('DELETE FROM bot_tasks WHERE bot_id = ?', [botId]);
  await db.run('DELETE FROM bots WHERE id = ?', [botId]);
  
  console.log('Cleanup completed: WinAgent removed.');
  await db.close();
})();
