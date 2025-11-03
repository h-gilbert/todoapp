const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const db = require('./database');

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(uploadsDir));

// Simple in-memory cache for frequently accessed data
const cache = {
  projects: new Map(),
  sections: new Map(),
  tasks: new Map(),
};

const CACHE_TTL = 5000; // 5 seconds

// Helper to get from cache
const getFromCache = (key, cacheMap) => {
  const cached = cacheMap.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

// Helper to set cache
const setCache = (key, data, cacheMap) => {
  cacheMap.set(key, { data, timestamp: Date.now() });
};

// Helper to invalidate cache
const invalidateCache = (pattern = null) => {
  if (pattern) {
    // Invalidate specific cache entries
    if (pattern.includes('projects')) cache.projects.clear();
    if (pattern.includes('sections')) cache.sections.clear();
    if (pattern.includes('tasks')) cache.tasks.clear();
  } else {
    // Clear all caches
    cache.projects.clear();
    cache.sections.clear();
    cache.tasks.clear();
  }
};

// Helper function to promisify database queries
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// ============ MIDDLEWARE ============

// Middleware to check if user has access to a project (owns it or it's shared with them)
const checkProjectAccess = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.query.userId || req.params.userId;
    const projectId = req.params.projectId || req.params.id || req.body.projectId;

    if (!userId || !projectId) {
      return res.status(400).json({ error: 'User ID and Project ID are required' });
    }

    // Check if user owns the project
    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);

    if (project) {
      req.project = project;
      req.isOwner = true;
      return next();
    }

    // Check if project is shared with user
    const share = await dbGet(
      'SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    if (share) {
      const sharedProject = await dbGet('SELECT * FROM projects WHERE id = ?', [projectId]);
      req.project = sharedProject;
      req.isOwner = false;
      return next();
    }

    return res.status(403).json({ error: 'Access denied to this project' });
  } catch (error) {
    console.error('Access check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user has access to a section (via project ownership or share)
const checkSectionAccess = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.query.userId || req.params.userId;
    const sectionId = req.params.sectionId || req.params.id || req.body.sectionId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!sectionId) {
      return res.status(400).json({ error: 'Section ID is required' });
    }

    // Get section's project
    const section = await dbGet('SELECT * FROM sections WHERE id = ?', [sectionId]);

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Check if user owns the project
    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [section.project_id, userId]);

    if (project) {
      req.section = section;
      req.project = project;
      req.isOwner = true;
      return next();
    }

    // Check if project is shared with user
    const share = await dbGet(
      'SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?',
      [section.project_id, userId]
    );

    if (share) {
      const sharedProject = await dbGet('SELECT * FROM projects WHERE id = ?', [section.project_id]);
      req.section = section;
      req.project = sharedProject;
      req.isOwner = false;
      return next();
    }

    return res.status(403).json({ error: 'Access denied to this section' });
  } catch (error) {
    console.error('Section access check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user has access to a task (via project ownership or share)
const checkTaskAccess = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.query.userId || req.params.userId;
    const taskId = req.params.id || req.body.taskId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Get task's section and project
    const task = await dbGet(
      `SELECT t.*, s.project_id
       FROM tasks t
       JOIN sections s ON t.section_id = s.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user owns the project
    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [task.project_id, userId]);

    if (project) {
      req.task = task;
      req.project = project;
      req.isOwner = true;
      return next();
    }

    // Check if project is shared with user
    const share = await dbGet(
      'SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?',
      [task.project_id, userId]
    );

    if (share) {
      const sharedProject = await dbGet('SELECT * FROM projects WHERE id = ?', [task.project_id]);
      req.task = task;
      req.project = sharedProject;
      req.isOwner = false;
      return next();
    }

    return res.status(403).json({ error: 'Access denied to this task' });
  } catch (error) {
    console.error('Task access check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============ USER ROUTES ============

// Register new user
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists
    const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await dbRun('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, password_hash]);
    const user = await dbGet('SELECT id, username, created_at FROM users WHERE id = ?', [result.lastID]);

    res.json(user);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check if user has password_hash (for backwards compatibility with old users)
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Please reset your password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Return user without password_hash
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
app.post('/api/users/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'User ID, current password, and new password are required' });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get user
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    if (!user.password_hash) {
      return res.status(401).json({ error: 'No password set for this user' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, userId]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ SEARCH ROUTES ============

// Search across all projects, sections, and tasks for a user
app.get('/api/users/:userId/search', async (req, res) => {
  try {
    const { userId } = req.params;
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = `%${q}%`;

    // Search tasks (title and description)
    const taskResults = await dbAll(
      `SELECT
        t.id as taskId,
        t.title as taskTitle,
        t.description,
        s.id as sectionId,
        s.name as sectionName,
        p.id as projectId,
        p.name as projectName,
        'task' as type
       FROM tasks t
       JOIN sections s ON t.section_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE p.user_id = ?
         AND (t.title LIKE ? OR t.description LIKE ?)
         AND t.archived = 0
         AND s.archived = 0
       ORDER BY p.name, s.name, t.title`,
      [userId, searchTerm, searchTerm]
    );

    // Search sections (name only)
    const sectionResults = await dbAll(
      `SELECT
        NULL as taskId,
        NULL as taskTitle,
        NULL as description,
        s.id as sectionId,
        s.name as sectionName,
        p.id as projectId,
        p.name as projectName,
        'section' as type
       FROM sections s
       JOIN projects p ON s.project_id = p.id
       WHERE p.user_id = ?
         AND s.name LIKE ?
         AND s.archived = 0
       ORDER BY p.name, s.name`,
      [userId, searchTerm]
    );

    // Combine and return results
    const results = [...taskResults, ...sectionResults];
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search within a specific project
app.get('/api/projects/:projectId/search', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = `%${q}%`;

    // Search tasks within the project
    const taskResults = await dbAll(
      `SELECT
        t.id as taskId,
        t.title as taskTitle,
        t.description,
        s.id as sectionId,
        s.name as sectionName,
        p.id as projectId,
        p.name as projectName,
        'task' as type
       FROM tasks t
       JOIN sections s ON t.section_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE p.id = ?
         AND (t.title LIKE ? OR t.description LIKE ?)
         AND t.archived = 0
         AND s.archived = 0
       ORDER BY s.name, t.title`,
      [projectId, searchTerm, searchTerm]
    );

    // Search sections within the project
    const sectionResults = await dbAll(
      `SELECT
        NULL as taskId,
        NULL as taskTitle,
        NULL as description,
        s.id as sectionId,
        s.name as sectionName,
        p.id as projectId,
        p.name as projectName,
        'section' as type
       FROM sections s
       JOIN projects p ON s.project_id = p.id
       WHERE p.id = ?
         AND s.name LIKE ?
         AND s.archived = 0
       ORDER BY s.name`,
      [projectId, searchTerm]
    );

    // Combine and return results
    const results = [...taskResults, ...sectionResults];
    res.json(results);
  } catch (error) {
    console.error('Project search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ PROJECT ROUTES ============

// Get all projects for a user (owned + shared)
app.get('/api/users/:userId/projects', async (req, res) => {
  try {
    const { userId } = req.params;
    const cacheKey = `user_${userId}_projects`;

    // Check cache first
    const cached = getFromCache(cacheKey, cache.projects);
    if (cached) {
      return res.json(cached);
    }

    // Get owned projects
    const ownedProjects = await dbAll(
      'SELECT *, user_id as owner_id, 1 as is_owner FROM projects WHERE user_id = ? ORDER BY order_index ASC',
      [userId]
    );

    // Get shared projects with owner info
    const sharedProjects = await dbAll(
      `SELECT p.*, p.user_id as owner_id, 0 as is_owner, u.username as owner_name
       FROM project_shares ps
       JOIN projects p ON ps.project_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE ps.user_id = ?
       ORDER BY p.name ASC`,
      [userId]
    );

    // Combine all projects
    const allProjects = [...ownedProjects, ...sharedProjects];

    if (allProjects.length === 0) {
      return res.json([]);
    }

    // Optimized: Use single query with GROUP BY instead of loop
    const taskCounts = await dbAll(
      `SELECT s.project_id, COUNT(t.id) as count
       FROM sections s
       LEFT JOIN tasks t ON t.section_id = s.id AND t.archived = 0
       WHERE s.project_id IN (${allProjects.map(() => '?').join(',')}) AND s.archived = 0
       GROUP BY s.project_id`,
      allProjects.map(p => p.id)
    );

    const taskCountMap = {};
    taskCounts.forEach(tc => {
      taskCountMap[tc.project_id] = tc.count;
    });

    const projectsWithCounts = allProjects.map(project => ({
      ...project,
      taskCount: taskCountMap[project.id] || 0
    }));

    // Cache the result
    setCache(cacheKey, projectsWithCounts, cache.projects);

    res.json(projectsWithCounts);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new project
app.post('/api/projects', async (req, res) => {
  try {
    const { userId, name } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: 'User ID and name are required' });
    }

    // Get the max order_index
    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM projects WHERE user_id = ?',
      [userId]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    const result = await dbRun(
      'INSERT INTO projects (user_id, name, order_index) VALUES (?, ?, ?)',
      [userId, name, orderIndex]
    );

    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [result.lastID]);

    // Invalidate projects cache
    invalidateCache('projects');

    res.json({ ...project, taskCount: 0 });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project
app.put('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await dbRun('UPDATE projects SET name = ? WHERE id = ?', [name, id]);
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [id]);

    // Invalidate projects cache
    invalidateCache('projects');

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM projects WHERE id = ?', [id]);

    // Invalidate projects cache
    invalidateCache('projects');

    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder projects
app.post('/api/projects/reorder', async (req, res) => {
  try {
    const { projectIds } = req.body;

    for (let i = 0; i < projectIds.length; i++) {
      await dbRun('UPDATE projects SET order_index = ? WHERE id = ?', [i, projectIds[i]]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ PROJECT SHARING ROUTES ============

// Share a project with another user by username
app.post('/api/projects/:id/share', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, userId } = req.body;

    if (!username || !userId) {
      return res.status(400).json({ error: 'Username and user ID are required' });
    }

    // Check if requester owns the project
    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [id, userId]);

    if (!project) {
      return res.status(403).json({ error: 'Only project owner can share the project' });
    }

    // Find the user to share with
    const userToShareWith = await dbGet('SELECT * FROM users WHERE username = ?', [username]);

    if (!userToShareWith) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow sharing with yourself
    if (userToShareWith.id === userId) {
      return res.status(400).json({ error: 'Cannot share project with yourself' });
    }

    // Check if already shared
    const existingShare = await dbGet(
      'SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?',
      [id, userToShareWith.id]
    );

    if (existingShare) {
      return res.status(409).json({ error: 'Project already shared with this user' });
    }

    // Create the share
    await dbRun(
      'INSERT INTO project_shares (project_id, user_id, shared_by_user_id) VALUES (?, ?, ?)',
      [id, userToShareWith.id, userId]
    );

    // Invalidate cache
    invalidateCache('projects');

    res.json({
      success: true,
      message: `Project shared with ${username}`,
      sharedWith: {
        id: userToShareWith.id,
        username: userToShareWith.username
      }
    });
  } catch (error) {
    console.error('Share project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users a project is shared with
app.get('/api/projects/:id/shares', async (req, res) => {
  try {
    const { id } = req.params;

    const shares = await dbAll(
      `SELECT ps.id as share_id, u.id, u.username, ps.created_at
       FROM project_shares ps
       JOIN users u ON ps.user_id = u.id
       WHERE ps.project_id = ?
       ORDER BY ps.created_at ASC`,
      [id]
    );

    res.json(shares);
  } catch (error) {
    console.error('Get shares error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove share access from a user
app.delete('/api/projects/:id/shares/:shareUserId', async (req, res) => {
  try {
    const { id, shareUserId } = req.params;
    const { userId } = req.query;

    // Check if requester owns the project
    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [id, userId]);

    if (!project) {
      return res.status(403).json({ error: 'Only project owner can remove shares' });
    }

    // Remove the share
    await dbRun(
      'DELETE FROM project_shares WHERE project_id = ? AND user_id = ?',
      [id, shareUserId]
    );

    // Invalidate cache
    invalidateCache('projects');

    res.json({ success: true });
  } catch (error) {
    console.error('Remove share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ SECTION ROUTES ============

// Get all sections for a project
app.get('/api/projects/:projectId/sections', async (req, res) => {
  try {
    const { projectId } = req.params;
    const sections = await dbAll(
      'SELECT * FROM sections WHERE project_id = ? AND archived = 0 ORDER BY order_index ASC',
      [projectId]
    );
    res.json(sections);
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new section
app.post('/api/sections', async (req, res) => {
  try {
    const { projectId, name } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM sections WHERE project_id = ?',
      [projectId]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    const result = await dbRun(
      'INSERT INTO sections (project_id, name, order_index) VALUES (?, ?, ?)',
      [projectId, name, orderIndex]
    );

    const section = await dbGet('SELECT * FROM sections WHERE id = ?', [result.lastID]);

    // Invalidate caches
    invalidateCache('sections');
    invalidateCache('projects'); // Project task counts may change

    res.json(section);
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update section
app.put('/api/sections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await dbRun('UPDATE sections SET name = ? WHERE id = ?', [name, id]);
    const section = await dbGet('SELECT * FROM sections WHERE id = ?', [id]);

    res.json(section);
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete section
app.delete('/api/sections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM sections WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder sections
app.post('/api/sections/reorder', async (req, res) => {
  try {
    const { sectionIds } = req.body;

    for (let i = 0; i < sectionIds.length; i++) {
      await dbRun('UPDATE sections SET order_index = ? WHERE id = ?', [i, sectionIds[i]]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder sections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Archive section
app.post('/api/sections/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;

    // Archive all completed tasks in this section
    await dbRun(
      'UPDATE tasks SET archived = 1 WHERE section_id = ? AND completed = 1',
      [id]
    );

    // Archive the section
    await dbRun('UPDATE sections SET archived = 1 WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Archive section error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unarchive section
app.post('/api/sections/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the section's project to calculate new order
    const section = await dbGet('SELECT project_id FROM sections WHERE id = ?', [id]);

    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM sections WHERE project_id = ? AND archived = 0',
      [section.project_id]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    await dbRun('UPDATE sections SET archived = 0, order_index = ? WHERE id = ?', [orderIndex, id]);

    const updatedSection = await dbGet('SELECT * FROM sections WHERE id = ?', [id]);
    res.json(updatedSection);
  } catch (error) {
    console.error('Unarchive section error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ TASK ROUTES ============

// Get all tasks for a section
app.get('/api/sections/:sectionId/tasks', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const tasks = await dbAll(
      'SELECT * FROM tasks WHERE section_id = ? AND archived = 0 ORDER BY order_index ASC',
      [sectionId]
    );
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { sectionId, title, description } = req.body;

    if (!sectionId || !title) {
      return res.status(400).json({ error: 'Section ID and title are required' });
    }

    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM tasks WHERE section_id = ? AND archived = 0',
      [sectionId]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    const result = await dbRun(
      'INSERT INTO tasks (section_id, title, description, order_index) VALUES (?, ?, ?, ?)',
      [sectionId, title, description || '', orderIndex]
    );

    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [result.lastID]);

    // Invalidate caches
    invalidateCache('tasks');
    invalidateCache('projects'); // Project task counts change

    res.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
// Note: When Claude marks a task as complete via API, set both:
//   completed: 1 (marks as done, shows strikethrough)
//   programmatic_completion: 1 (keeps checkbox unchecked so user can still manually archive)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed, programmatic_completion } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      params.push(completed ? 1 : 0);
    }
    if (programmatic_completion !== undefined) {
      updates.push('programmatic_completion = ?');
      params.push(programmatic_completion ? 1 : 0);
    }

    params.push(id);

    await dbRun(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);
    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);

    // Invalidate task cache
    invalidateCache('tasks');

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Archive task
app.post('/api/tasks/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('UPDATE tasks SET archived = 1 WHERE id = ?', [id]);

    // Invalidate caches
    invalidateCache('tasks');
    invalidateCache('projects');

    res.json({ success: true });
  } catch (error) {
    console.error('Archive task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unarchive task
app.post('/api/tasks/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the task's section to calculate new order
    const task = await dbGet('SELECT section_id FROM tasks WHERE id = ?', [id]);

    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM tasks WHERE section_id = ? AND archived = 0',
      [task.section_id]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    await dbRun('UPDATE tasks SET archived = 0, completed = 0, programmatic_completion = 0, order_index = ? WHERE id = ?', [orderIndex, id]);

    const updatedTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(updatedTask);
  } catch (error) {
    console.error('Unarchive task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get archived tasks for a project
app.get('/api/projects/:projectId/archived', async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await dbAll(
      `SELECT t.*, s.name as section_name
       FROM tasks t
       JOIN sections s ON t.section_id = s.id
       WHERE s.project_id = ? AND t.archived = 1
       ORDER BY t.id DESC`,
      [projectId]
    );
    res.json(tasks);
  } catch (error) {
    console.error('Get archived tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get archived sections for a project
app.get('/api/projects/:projectId/archived-sections', async (req, res) => {
  try {
    const { projectId } = req.params;
    const sections = await dbAll(
      `SELECT * FROM sections
       WHERE project_id = ? AND archived = 1
       ORDER BY id DESC`,
      [projectId]
    );
    res.json(sections);
  } catch (error) {
    console.error('Get archived sections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM tasks WHERE id = ?', [id]);

    // Invalidate caches
    invalidateCache('tasks');
    invalidateCache('projects');

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Move task to different section
app.post('/api/tasks/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId, targetIndex } = req.body;

    // If targetIndex is provided, we need to reorder tasks
    if (targetIndex !== undefined) {
      // Get all tasks in the target section
      const targetSectionTasks = await dbAll(
        'SELECT id FROM tasks WHERE section_id = ? AND archived = 0 ORDER BY order_index ASC',
        [sectionId]
      );

      // Update the task's section
      await dbRun(
        'UPDATE tasks SET section_id = ? WHERE id = ?',
        [sectionId, id]
      );

      // Create new order with the moved task inserted at targetIndex
      const taskIds = targetSectionTasks.map(t => t.id).filter(taskId => taskId !== parseInt(id));
      taskIds.splice(targetIndex, 0, parseInt(id));

      // Update order for all tasks in the section
      for (let i = 0; i < taskIds.length; i++) {
        await dbRun('UPDATE tasks SET order_index = ? WHERE id = ?', [i, taskIds[i]]);
      }
    } else {
      // No specific index, append to end
      const maxOrder = await dbGet(
        'SELECT MAX(order_index) as max FROM tasks WHERE section_id = ? AND archived = 0',
        [sectionId]
      );
      const orderIndex = (maxOrder.max || 0) + 1;

      await dbRun(
        'UPDATE tasks SET section_id = ?, order_index = ? WHERE id = ?',
        [sectionId, orderIndex, id]
      );
    }

    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(task);
  } catch (error) {
    console.error('Move task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder tasks
app.post('/api/tasks/reorder', async (req, res) => {
  try {
    const { taskIds } = req.body;

    for (let i = 0; i < taskIds.length; i++) {
      await dbRun('UPDATE tasks SET order_index = ? WHERE id = ?', [i, taskIds[i]]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ PHOTO ROUTES ============

// Upload photos for a task
app.post('/api/tasks/:id/photos', upload.array('photos', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Insert photo records into database
    const photos = [];
    for (const file of files) {
      const result = await dbRun(
        'INSERT INTO task_photos (task_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
        [id, file.filename, file.originalname, file.mimetype, file.size]
      );

      const photo = await dbGet('SELECT * FROM task_photos WHERE id = ?', [result.lastID]);
      photos.push(photo);
    }

    res.json(photos);
  } catch (error) {
    console.error('Upload photos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get photos for a task
app.get('/api/tasks/:id/photos', async (req, res) => {
  try {
    const { id } = req.params;
    const photos = await dbAll(
      'SELECT * FROM task_photos WHERE task_id = ? ORDER BY created_at ASC',
      [id]
    );
    res.json(photos);
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a photo
app.delete('/api/photos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get photo info to delete file
    const photo = await dbGet('SELECT * FROM task_photos WHERE id = ?', [id]);

    if (photo) {
      // Delete file from filesystem
      const filePath = path.join(uploadsDir, photo.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      await dbRun('DELETE FROM task_photos WHERE id = ?', [id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
