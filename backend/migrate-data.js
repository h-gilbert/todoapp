const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Local database path
const localDbPath = path.join(__dirname, 'data/todos.db');

// Configuration - edit these to match your setup
const REAL_USERNAME = 'your-username'; // Your username to export
const EXCLUDED_PROJECT_NAME = ''; // Project name to exclude (case-insensitive), leave empty to include all

// Open local database
const localDb = new sqlite3.Database(localDbPath, sqlite3.OPEN_READONLY);

const exportData = async () => {
  const data = {
    users: [],
    projects: [],
    sections: [],
    tasks: [],
    task_photos: [],
    project_shares: []
  };

  return new Promise((resolve, reject) => {
    localDb.serialize(() => {
      // Get all users
      localDb.all('SELECT * FROM users', (err, users) => {
        if (err) {
          reject(err);
          return;
        }

        // Filter: Only include the specified user
        const realUser = users.find(u => u.username.toLowerCase() === REAL_USERNAME.toLowerCase());
        if (!realUser) {
          reject(new Error(`User "${REAL_USERNAME}" not found in database`));
          return;
        }

        data.users.push(realUser);
        console.log(`✓ Found user: ${realUser.username} (ID: ${realUser.id})`);

        // Get all projects for the real user
        localDb.all('SELECT * FROM projects WHERE user_id = ?', [realUser.id], (err, projects) => {
          if (err) {
            reject(err);
            return;
          }

          // Filter out the excluded project
          const filteredProjects = projects.filter(p =>
            p.name.toLowerCase() !== EXCLUDED_PROJECT_NAME.toLowerCase()
          );

          const excludedProject = projects.find(p =>
            p.name.toLowerCase() === EXCLUDED_PROJECT_NAME.toLowerCase()
          );

          if (excludedProject) {
            console.log(`✗ Excluding project: "${excludedProject.name}" (ID: ${excludedProject.id})`);
          }

          data.projects = filteredProjects;
          console.log(`✓ Including ${filteredProjects.length} project(s):`);
          filteredProjects.forEach(p => console.log(`  - ${p.name}`));

          if (filteredProjects.length === 0) {
            console.log('\n📦 Export Data Summary:');
            console.log(JSON.stringify(data, null, 2));
            resolve(data);
            return;
          }

          const projectIds = filteredProjects.map(p => p.id);
          const placeholders = projectIds.map(() => '?').join(',');

          // Get sections for filtered projects
          localDb.all(`SELECT * FROM sections WHERE project_id IN (${placeholders})`, projectIds, (err, sections) => {
            if (err) {
              reject(err);
              return;
            }

            data.sections = sections;
            console.log(`✓ Found ${sections.length} section(s)`);

            if (sections.length === 0) {
              console.log('\n📦 Export Data Summary:');
              console.log(JSON.stringify(data, null, 2));
              resolve(data);
              return;
            }

            const sectionIds = sections.map(s => s.id);
            const sectionPlaceholders = sectionIds.map(() => '?').join(',');

            // Get tasks for those sections
            localDb.all(`SELECT * FROM tasks WHERE section_id IN (${sectionPlaceholders})`, sectionIds, (err, tasks) => {
              if (err) {
                reject(err);
                return;
              }

              data.tasks = tasks;
              console.log(`✓ Found ${tasks.length} task(s)`);

              if (tasks.length === 0) {
                console.log('\n📦 Export Data Summary:');
                console.log(JSON.stringify(data, null, 2));
                resolve(data);
                return;
              }

              const taskIds = tasks.map(t => t.id);
              const taskPlaceholders = taskIds.map(() => '?').join(',');

              // Get task photos
              localDb.all(`SELECT * FROM task_photos WHERE task_id IN (${taskPlaceholders})`, taskIds, (err, photos) => {
                if (err) {
                  reject(err);
                  return;
                }

                data.task_photos = photos;
                console.log(`✓ Found ${photos.length} photo(s)`);

                // Get project shares for filtered projects (if table exists)
                localDb.all(`SELECT * FROM project_shares WHERE project_id IN (${placeholders})`, projectIds, (err, shares) => {
                  if (err) {
                    // Table might not exist in older databases
                    console.log(`⚠ No project_shares table found (this is OK for older databases)`);
                    data.project_shares = [];
                  } else {
                    data.project_shares = shares || [];
                    console.log(`✓ Found ${shares.length} project share(s)`);
                  }

                  console.log('\n📦 Export Data Summary:');
                  console.log(JSON.stringify(data, null, 2));

                  // Save to file
                  const fs = require('fs');
                  const exportPath = path.join(__dirname, 'export-data.json');
                  fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
                  console.log(`\n💾 Data saved to: ${exportPath}`);

                  resolve(data);
                });
              });
            });
          });
        });
      });
    });
  });
};

// Run export
console.log('🔄 Starting data export...\n');
exportData()
  .then(data => {
    console.log('\n✅ Export completed successfully!');
    console.log('\nTo import this data to your production server:');
    console.log('1. Copy export-data.json to your server');
    console.log('2. Run the import script (coming next)');
  })
  .catch(err => {
    console.error('❌ Export failed:', err);
    process.exit(1);
  })
  .finally(() => {
    localDb.close();
  });
