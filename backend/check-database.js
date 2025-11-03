const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/todos.db');
const db = new sqlite3.Database(dbPath);

console.log('📊 Database Diagnostics\n');
console.log(`Database path: ${dbPath}\n`);

db.serialize(() => {
  // Check users
  db.all('SELECT id, username, created_at, password_hash FROM users', [], (err, users) => {
    if (err) {
      console.error('❌ Error querying users:', err.message);
    } else {
      console.log(`Users (${users.length}):`);
      if (users.length === 0) {
        console.log('  No users found');
      } else {
        users.forEach(user => {
          const hasPassword = user.password_hash ? 'Yes' : 'No';
          console.log(`  - ID: ${user.id}, Username: ${user.username}, Has password: ${hasPassword}`);
        });
      }
    }
    console.log('');

    // Check projects
    db.all('SELECT id, user_id, name FROM projects LIMIT 5', [], (err, projects) => {
      if (err) {
        console.error('❌ Error querying projects:', err.message);
      } else {
        console.log(`Projects (showing first 5 of total):`);
        if (projects.length === 0) {
          console.log('  No projects found');
        } else {
          projects.forEach(project => {
            console.log(`  - ID: ${project.id}, Name: ${project.name}, User ID: ${project.user_id}`);
          });
        }
      }
      console.log('');

      // Check sections
      db.all('SELECT COUNT(*) as count FROM sections', [], (err, result) => {
        if (err) {
          console.error('❌ Error counting sections:', err.message);
        } else {
          console.log(`Sections: ${result[0].count}`);
        }

        // Check tasks
        db.all('SELECT COUNT(*) as count FROM tasks', [], (err, result) => {
          if (err) {
            console.error('❌ Error counting tasks:', err.message);
          } else {
            console.log(`Tasks: ${result[0].count}`);
          }

          // Check table schema for users
          console.log('\n📋 Users table schema:');
          db.all('PRAGMA table_info(users)', [], (err, columns) => {
            if (err) {
              console.error('❌ Error getting schema:', err.message);
            } else {
              columns.forEach(col => {
                console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
              });
            }

            db.close();
          });
        });
      });
    });
  });
});
