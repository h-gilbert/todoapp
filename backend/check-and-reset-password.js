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

console.log('🔐 Password Reset Tool with Diagnostics\n');

// First, check what users exist
db.all('SELECT id, username, created_at, password_hash FROM users', [], (err, users) => {
  if (err) {
    console.error('❌ Error querying users:', err.message);
    db.close();
    rl.close();
    return;
  }

  if (users.length === 0) {
    console.log('❌ No users found in database!');
    db.close();
    rl.close();
    return;
  }

  console.log(`Found ${users.length} user(s):`);
  users.forEach(user => {
    const hasPassword = user.password_hash ? 'Yes' : 'No';
    console.log(`  - ${user.username} (ID: ${user.id}, Has password: ${hasPassword})`);
  });
  console.log('');

  rl.question('Enter username to reset: ', (username) => {
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
});
