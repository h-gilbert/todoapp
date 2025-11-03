const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'todos.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Sections table
  db.run(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      archived BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Tasks table
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      completed BOOLEAN DEFAULT 0,
      programmatic_completion BOOLEAN DEFAULT 0,
      archived BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    )
  `);

  // Task photos table
  db.run(`
    CREATE TABLE IF NOT EXISTS task_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Project shares table (for sharing projects with other users)
  db.run(`
    CREATE TABLE IF NOT EXISTS project_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      shared_by_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id)
    )
  `);

  // Migration: Add archived column to sections if it doesn't exist
  db.run(`
    PRAGMA table_info(sections)
  `, (err, rows) => {
    if (err) {
      console.error('Error checking sections table:', err);
      return;
    }
  });

  // Try to add archived column (will fail silently if it already exists)
  db.run(`ALTER TABLE sections ADD COLUMN archived BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration error:', err);
    } else if (!err) {
      console.log('Added archived column to sections table');
    }
  });

  // Migration: Add programmatic_completion column to tasks if it doesn't exist
  db.run(`ALTER TABLE tasks ADD COLUMN programmatic_completion BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration error:', err);
    } else if (!err) {
      console.log('Added programmatic_completion column to tasks table');
    }
  });

  // Migration: Add password_hash column to users if it doesn't exist
  db.run(`ALTER TABLE users ADD COLUMN password_hash TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration error:', err);
    } else if (!err) {
      console.log('Added password_hash column to users table');
    }
  });

  // Create performance indexes for faster queries
  // Index for filtering projects by user
  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`, (err) => {
    if (err) console.error('Error creating idx_projects_user_id:', err);
  });

  // Index for filtering sections by project and archived status
  db.run(`CREATE INDEX IF NOT EXISTS idx_sections_project_id ON sections(project_id)`, (err) => {
    if (err) console.error('Error creating idx_sections_project_id:', err);
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_sections_archived ON sections(archived)`, (err) => {
    if (err) console.error('Error creating idx_sections_archived:', err);
  });

  // Composite index for common section queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_sections_project_archived ON sections(project_id, archived)`, (err) => {
    if (err) console.error('Error creating idx_sections_project_archived:', err);
  });

  // Index for filtering tasks by section
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_section_id ON tasks(section_id)`, (err) => {
    if (err) console.error('Error creating idx_tasks_section_id:', err);
  });

  // Index for filtering tasks by archived status
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived)`, (err) => {
    if (err) console.error('Error creating idx_tasks_archived:', err);
  });

  // Index for filtering tasks by completed status
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)`, (err) => {
    if (err) console.error('Error creating idx_tasks_completed:', err);
  });

  // Composite index for common task queries (section + archived)
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_section_archived ON tasks(section_id, archived)`, (err) => {
    if (err) console.error('Error creating idx_tasks_section_archived:', err);
  });

  // Index for search queries on task title
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title)`, (err) => {
    if (err) console.error('Error creating idx_tasks_title:', err);
  });

  // Index for task photos lookup
  db.run(`CREATE INDEX IF NOT EXISTS idx_task_photos_task_id ON task_photos(task_id)`, (err) => {
    if (err) console.error('Error creating idx_task_photos_task_id:', err);
  });

  // Indexes for project_shares
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id)`, (err) => {
    if (err) console.error('Error creating idx_project_shares_project_id:', err);
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_project_shares_user_id ON project_shares(user_id)`, (err) => {
    if (err) console.error('Error creating idx_project_shares_user_id:', err);
  });

  console.log('Database initialized successfully with performance indexes');
});

module.exports = db;
