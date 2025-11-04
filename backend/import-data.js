const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Production database path (on server this will be in /app/data/)
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data/todos.db');
const exportDataPath = path.join(__dirname, 'export-data.json');

// Check if export data file exists
if (!fs.existsSync(exportDataPath)) {
  console.error(`❌ Export data file not found: ${exportDataPath}`);
  console.error('Please copy export-data.json to this directory first');
  process.exit(1);
}

// Load export data
const exportData = JSON.parse(fs.readFileSync(exportDataPath, 'utf8'));

// Open production database
const db = new sqlite3.Database(dbPath);

const importData = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🔄 Starting data import...\n');

      // Begin transaction
      db.run('BEGIN TRANSACTION');

      try {
        // Track ID mappings for foreign keys
        const idMap = {
          users: {},
          projects: {},
          sections: {},
          tasks: {}
        };

        // Import users
        console.log(`📝 Importing ${exportData.users.length} user(s)...`);
        exportData.users.forEach(user => {
          const stmt = db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)');
          stmt.run(user.username, user.password_hash, user.created_at, function(err) {
            if (err) {
              if (err.message.includes('UNIQUE constraint failed')) {
                // User already exists, get their ID
                db.get('SELECT id FROM users WHERE username = ?', [user.username], (err, existingUser) => {
                  if (existingUser) {
                    idMap.users[user.id] = existingUser.id;
                    console.log(`  ✓ User "${user.username}" already exists (using ID: ${existingUser.id})`);
                  }
                });
              } else {
                throw err;
              }
            } else {
              idMap.users[user.id] = this.lastID;
              console.log(`  ✓ Imported user: ${user.username} (new ID: ${this.lastID})`);
            }
          });
          stmt.finalize();
        });

        // Wait a bit for user imports to complete
        setTimeout(() => {
          // Import projects
          console.log(`\n📁 Importing ${exportData.projects.length} project(s)...`);
          exportData.projects.forEach(project => {
            const newUserId = idMap.users[project.user_id];
            if (!newUserId) {
              console.error(`  ❌ Skipping project "${project.name}": user ID ${project.user_id} not found`);
              return;
            }

            const stmt = db.prepare('INSERT INTO projects (user_id, name, order_index, created_at) VALUES (?, ?, ?, ?)');
            stmt.run(newUserId, project.name, project.order_index, project.created_at, function(err) {
              if (err) {
                console.error(`  ❌ Error importing project "${project.name}":`, err.message);
              } else {
                idMap.projects[project.id] = this.lastID;
                console.log(`  ✓ Imported project: ${project.name} (new ID: ${this.lastID})`);
              }
            });
            stmt.finalize();
          });

          setTimeout(() => {
            // Import sections
            console.log(`\n📋 Importing ${exportData.sections.length} section(s)...`);
            exportData.sections.forEach(section => {
              const newProjectId = idMap.projects[section.project_id];
              if (!newProjectId) {
                console.error(`  ❌ Skipping section "${section.name}": project ID ${section.project_id} not found`);
                return;
              }

              const stmt = db.prepare('INSERT INTO sections (project_id, name, order_index, archived, created_at) VALUES (?, ?, ?, ?, ?)');
              stmt.run(newProjectId, section.name, section.order_index, section.archived, section.created_at, function(err) {
                if (err) {
                  console.error(`  ❌ Error importing section "${section.name}":`, err.message);
                } else {
                  idMap.sections[section.id] = this.lastID;
                  console.log(`  ✓ Imported section: ${section.name} (new ID: ${this.lastID})`);
                }
              });
              stmt.finalize();
            });

            setTimeout(() => {
              // Import tasks
              console.log(`\n✅ Importing ${exportData.tasks.length} task(s)...`);
              exportData.tasks.forEach(task => {
                const newSectionId = idMap.sections[task.section_id];
                if (!newSectionId) {
                  console.error(`  ❌ Skipping task "${task.title}": section ID ${task.section_id} not found`);
                  return;
                }

                const stmt = db.prepare('INSERT INTO tasks (section_id, title, description, order_index, completed, programmatic_completion, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                stmt.run(newSectionId, task.title, task.description, task.order_index, task.completed, task.programmatic_completion || 0, task.archived, task.created_at, function(err) {
                  if (err) {
                    console.error(`  ❌ Error importing task "${task.title}":`, err.message);
                  } else {
                    idMap.tasks[task.id] = this.lastID;
                    console.log(`  ✓ Imported task: ${task.title.substring(0, 50)}... (new ID: ${this.lastID})`);
                  }
                });
                stmt.finalize();
              });

              setTimeout(() => {
                // Commit transaction
                db.run('COMMIT', (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    console.log('\n✅ Import completed successfully!');
                    console.log('\nSummary:');
                    console.log(`  Users: ${exportData.users.length}`);
                    console.log(`  Projects: ${exportData.projects.length}`);
                    console.log(`  Sections: ${exportData.sections.length}`);
                    console.log(`  Tasks: ${exportData.tasks.length}`);
                    resolve();
                  }
                });
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);

      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
};

// Run import
importData()
  .catch(err => {
    console.error('\n❌ Import failed:', err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
