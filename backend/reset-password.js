const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data/todos.db');
const db = new sqlite3.Database(dbPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 Password Reset Tool\n');

rl.question('Enter username: ', (username) => {
  rl.question('Enter new password: ', async (password) => {
    try {
      const passwordHash = await bcrypt.hash(password, 10);

      db.run(
        'UPDATE users SET password_hash = ? WHERE username = ?',
        [passwordHash, username],
        function(err) {
          if (err) {
            console.error('❌ Error:', err.message);
          } else if (this.changes === 0) {
            console.log(`❌ User "${username}" not found`);
          } else {
            console.log(`✅ Password updated for user "${username}"`);
          }
          db.close();
          rl.close();
        }
      );
    } catch (error) {
      console.error('❌ Error hashing password:', error);
      db.close();
      rl.close();
    }
  });
});
