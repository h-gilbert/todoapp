// Deployment Test - Last verified: 2025-11-08
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { doubleCsrf } = require('csrf-csrf');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3500;

// JWT Configuration
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is required in production');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set. Using random secret (tokens will be invalid after restart)');
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = '7d';

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
    // Allow images and documents for bug reports and task attachments
    const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|txt|log|md|json|xml|csv|zip|tar|gz/;
    const allowedMimeTypes = /image\/.*|application\/pdf|text\/.*|application\/json|application\/xml|application\/zip|application\/x-tar|application\/gzip/;

    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('File type not allowed. Supported: images, PDF, text files, logs, JSON, XML, CSV, ZIP'));
    }
  }
});

// Security middleware
app.use(helmet());

// CORS configuration - restrict to allowed origins
const allowedOrigins = [
  'http://localhost:5176',
  'http://localhost:3001'
];
// Add production origin from environment variable
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser());

// CSRF Protection using Double-Submit Cookie pattern
const isProduction = process.env.NODE_ENV === 'production';
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || JWT_SECRET,
  cookieName: isProduction ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/'
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply general rate limiting to all API routes
app.use('/api', generalLimiter);

// CSRF token endpoint - returns token for frontend to use in X-CSRF-Token header
app.get('/api/csrf-token', (req, res) => {
  try {
    const token = generateToken(req, res);
    res.json({ csrfToken: token });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
});

// Apply CSRF protection to state-changing routes (excludes auth endpoints for initial login)
// CSRF protection is applied selectively to avoid blocking mobile app requests that use Bearer tokens
const csrfProtectedRoutes = [
  '/api/projects',
  '/api/sections',
  '/api/tasks',
  '/api/labels',
  '/api/tokens'
];

// Apply CSRF protection only when request comes from cookie-based auth (web clients)
const conditionalCsrf = (req, res, next) => {
  // Skip CSRF for requests using Authorization header (mobile/API clients)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }
  // Apply CSRF protection for cookie-based auth
  return doubleCsrfProtection(req, res, next);
};

csrfProtectedRoutes.forEach(route => {
  app.use(route, conditionalCsrf);
});

// Note: Static file serving removed for security - use /api/files/:filename endpoint instead

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

// Helper function to generate a secure API token
const generateApiToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Password validation helper
const validatePassword = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return errors;
};

// ============ MIDDLEWARE ============

// Bearer token authentication middleware - REQUIRES valid token
// Supports both httpOnly cookies (web) and Authorization header (mobile/API)
const authenticateToken = async (req, res, next) => {
  // Try cookie first, then Authorization header
  const cookieToken = req.cookies?.accessToken;
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Try JWT first
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      req.authenticatedViaJWT = true;
      return next();
    } catch (jwtError) {
      // JWT verification failed, try API token fallback for MCP compatibility
    }

    // Fall back to API token for MCP compatibility
    const tokenRecord = await dbGet(
      'SELECT * FROM api_tokens WHERE token = ?',
      [token]
    );

    if (tokenRecord && (!tokenRecord.expires_at || new Date(tokenRecord.expires_at) > new Date())) {
      req.userId = tokenRecord.user_id;
      req.tokenScopes = tokenRecord.scopes.split(',');
      req.authenticatedViaToken = true;
      await dbRun(
        'UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [tokenRecord.id]
      );
      return next();
    }

    return res.status(403).json({ error: 'Invalid or expired token' });
  } catch (error) {
    console.error('Token authentication error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to verify the authenticated user matches the requested user
const verifyUserMatch = (req, res, next) => {
  const requestedUserId = parseInt(req.params.userId);
  if (req.userId !== requestedUserId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// Middleware to check if user has access to a project (owns it or it's shared with them)
const checkProjectAccess = async (req, res, next) => {
  try {
    const userId = req.userId; // From authenticated token
    const projectId = req.params.projectId || req.params.id || req.body.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
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
    const userId = req.userId; // From authenticated token
    const sectionId = req.params.sectionId || req.params.id || req.body.sectionId;

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
    const userId = req.userId; // From authenticated token
    const taskId = req.params.id || req.params.taskId || req.body.taskId;

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

// Note: Authentication is applied per-route, not globally, to allow public endpoints like login/register/health

// ============ USER ROUTES ============

// Register new user
app.post('/api/users/register', authLimiter, async (req, res) => {
  try {
    // Check if registration is disabled
    if (process.env.REGISTRATION_DISABLED === 'true') {
      return res.status(403).json({ error: 'Registration is currently disabled' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordErrors
      });
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

    // Generate JWT access token
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    // Generate refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    // Store refresh token
    await dbRun(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );

    // Set httpOnly cookies for web clients
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/users' // Only sent to auth endpoints
    });

    res.json({
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
app.post('/api/users/login', authLimiter, async (req, res) => {
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

    // Generate JWT access token
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    // Generate refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    // Store refresh token
    await dbRun(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );

    // Set httpOnly cookies for web clients
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/users' // Only sent to auth endpoints
    });

    // Return user without password_hash, plus tokens (for mobile app compatibility)
    const { password_hash, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh access token
app.post('/api/users/refresh-token', async (req, res) => {
  try {
    // Accept refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Find valid refresh token
    const tokenRecord = await dbGet(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")',
      [refreshToken]
    );

    if (!tokenRecord) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    // Generate new access token
    const accessToken = jwt.sign({ userId: tokenRecord.user_id }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    // Set new access token cookie for web clients
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout user
app.post('/api/users/logout', authenticateToken, async (req, res) => {
  try {
    // Accept refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      // Delete the refresh token
      await dbRun('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }

    // Clear cookies
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/users' });

    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
app.post('/api/users/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate new password strength
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: 'New password does not meet requirements',
        details: passwordErrors
      });
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

// ============ API TOKEN ROUTES ============

// Generate a new API token
app.post('/api/users/:userId/tokens', authenticateToken, verifyUserMatch, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const { name, scopes, expiresInDays } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Token name is required' });
    }

    // Generate token
    const token = generateApiToken();

    // Set scopes (default to read if not specified)
    const tokenScopes = scopes || 'read';

    // Calculate expiration date if specified
    let expiresAt = null;
    if (expiresInDays) {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + parseInt(expiresInDays));
      expiresAt = expireDate.toISOString();
    }

    // Insert token
    const result = await dbRun(
      'INSERT INTO api_tokens (user_id, token, name, scopes, expires_at) VALUES (?, ?, ?, ?, ?)',
      [userId, token, name, tokenScopes, expiresAt]
    );

    const tokenRecord = await dbGet('SELECT * FROM api_tokens WHERE id = ?', [result.lastID]);

    res.json(tokenRecord);
  } catch (error) {
    console.error('Generate token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all API tokens for a user
app.get('/api/users/:userId/tokens', authenticateToken, verifyUserMatch, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token

    const tokens = await dbAll(
      'SELECT id, user_id, name, scopes, expires_at, last_used_at, created_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // Don't return the actual token values for security
    res.json(tokens);
  } catch (error) {
    console.error('Get tokens error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke an API token
app.delete('/api/tokens/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From authenticated token

    // Verify the token belongs to the user before deleting
    const token = await dbGet('SELECT * FROM api_tokens WHERE id = ? AND user_id = ?', [id, userId]);

    if (!token) {
      return res.status(404).json({ error: 'Token not found or access denied' });
    }

    await dbRun('DELETE FROM api_tokens WHERE id = ?', [id]);

    res.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    console.error('Delete token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ SEARCH ROUTES ============

// Search across all projects, sections, and tasks for a user
app.get('/api/users/:userId/search', authenticateToken, verifyUserMatch, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const { q, labelId } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = `%${q}%`;

    // Build task query with optional filters
    let taskQuery = `SELECT
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
       JOIN projects p ON s.project_id = p.id`;

    const taskParams = [userId, searchTerm, searchTerm];

    // Add label filter if specified
    if (labelId) {
      taskQuery += ` JOIN task_labels tl ON t.id = tl.task_id`;
    }

    taskQuery += ` WHERE p.user_id = ?
         AND (t.title LIKE ? OR t.description LIKE ?)
         AND t.archived = 0
         AND s.archived = 0`;

    // Add label filter if specified
    if (labelId) {
      taskQuery += ` AND tl.label_id = ?`;
      taskParams.push(labelId);
    }

    taskQuery += ` ORDER BY p.name, s.name, t.title`;

    const taskResults = await dbAll(taskQuery, taskParams);

    // Search sections (name only) - no label filters for sections
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

    // Search projects (name and description)
    const projectResults = await dbAll(
      `SELECT
        NULL as taskId,
        NULL as taskTitle,
        p.description as description,
        NULL as sectionId,
        NULL as sectionName,
        p.id as projectId,
        p.name as projectName,
        'project' as type
       FROM projects p
       WHERE p.user_id = ?
         AND (p.name LIKE ? OR p.description LIKE ?)
       ORDER BY p.name`,
      [userId, searchTerm, searchTerm]
    );

    // Combine and return results (projects first, then sections, then tasks)
    const results = [...projectResults, ...sectionResults, ...taskResults];
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search within a specific project
app.get('/api/projects/:projectId/search', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { q, labelId } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = `%${q}%`;

    // Build task query with optional filters
    let taskQuery = `SELECT
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
       JOIN projects p ON s.project_id = p.id`;

    const taskParams = [projectId, searchTerm, searchTerm];

    // Add label filter if specified
    if (labelId) {
      taskQuery += ` JOIN task_labels tl ON t.id = tl.task_id`;
    }

    taskQuery += ` WHERE p.id = ?
         AND (t.title LIKE ? OR t.description LIKE ?)
         AND t.archived = 0
         AND s.archived = 0`;

    // Add label filter if specified
    if (labelId) {
      taskQuery += ` AND tl.label_id = ?`;
      taskParams.push(labelId);
    }

    taskQuery += ` ORDER BY s.name, t.title`;

    const taskResults = await dbAll(taskQuery, taskParams);

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
app.get('/api/users/:userId/projects', authenticateToken, verifyUserMatch, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const cacheKey = `user_${userId}_projects`;

    // Check cache first
    const cached = getFromCache(cacheKey, cache.projects);
    if (cached) {
      return res.json(cached);
    }

    // Get owned projects (excluding archived)
    const ownedProjects = await dbAll(
      'SELECT *, user_id as owner_id FROM projects WHERE user_id = ? AND (archived = 0 OR archived IS NULL) ORDER BY order_index ASC',
      [userId]
    );
    // Add is_owner flag as boolean
    ownedProjects.forEach(p => p.is_owner = true);

    // Get shared projects with owner info (excluding archived)
    const sharedProjects = await dbAll(
      `SELECT p.*, p.user_id as owner_id, u.username as owner_name
       FROM project_shares ps
       JOIN projects p ON ps.project_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE ps.user_id = ? AND (p.archived = 0 OR p.archived IS NULL)
       ORDER BY p.name ASC`,
      [userId]
    );
    // Add is_owner flag as boolean
    sharedProjects.forEach(p => p.is_owner = false);

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

    // Get share counts for owned projects
    const shareCounts = await dbAll(
      `SELECT project_id, COUNT(*) as share_count
       FROM project_shares
       WHERE project_id IN (${allProjects.map(() => '?').join(',')})
       GROUP BY project_id`,
      allProjects.map(p => p.id)
    );

    const shareCountMap = {};
    shareCounts.forEach(sc => {
      shareCountMap[sc.project_id] = sc.share_count;
    });

    const projectsWithCounts = allProjects.map(project => ({
      ...project,
      taskCount: taskCountMap[project.id] || 0,
      sharedWithCount: shareCountMap[project.id] || 0
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
app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Get the max order_index
    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM projects WHERE user_id = ?',
      [userId]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    const result = await dbRun(
      'INSERT INTO projects (user_id, name, description, order_index) VALUES (?, ?, ?, ?)',
      [userId, name, description || '', orderIndex]
    );

    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [result.lastID]);

    // Invalidate projects cache
    invalidateCache('projects');

    res.json({ ...project, taskCount: 0, is_owner: true, sharedWithCount: 0 });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project
app.put('/api/projects/:id', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await dbRun(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);
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
app.delete('/api/projects/:id', authenticateToken, checkProjectAccess, async (req, res) => {
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
app.post('/api/projects/reorder', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectIds } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ error: 'projectIds array is required' });
    }

    // Verify all projects belong to the user (owned or shared)
    for (const projectId of projectIds) {
      const owned = await dbGet(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [projectId, userId]
      );
      const shared = !owned && await dbGet(
        'SELECT id FROM project_shares WHERE project_id = ? AND user_id = ?',
        [projectId, userId]
      );
      if (!owned && !shared) {
        return res.status(403).json({ error: 'Access denied to one or more projects' });
      }
    }

    // Only reorder projects the user owns
    for (let i = 0; i < projectIds.length; i++) {
      await dbRun(
        'UPDATE projects SET order_index = ? WHERE id = ? AND user_id = ?',
        [i, projectIds[i], userId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Archive project
app.post('/api/projects/:id/archive', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun(
      'UPDATE projects SET archived = 1, archived_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    // Invalidate projects cache
    invalidateCache('projects');

    res.json({ success: true });
  } catch (error) {
    console.error('Archive project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unarchive project
app.post('/api/projects/:id/unarchive', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun(
      'UPDATE projects SET archived = 0, archived_at = NULL WHERE id = ?',
      [id]
    );

    // Invalidate projects cache
    invalidateCache('projects');

    res.json({ success: true });
  } catch (error) {
    console.error('Unarchive project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get archived projects for a user
app.get('/api/users/:userId/archived-projects', authenticateToken, verifyUserMatch, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const projects = await dbAll(
      `SELECT p.*,
        (SELECT COUNT(*) FROM sections s WHERE s.project_id = p.id AND s.archived = 0) as sectionCount,
        (SELECT COUNT(*) FROM tasks t JOIN sections s ON t.section_id = s.id WHERE s.project_id = p.id AND t.archived = 0) as taskCount
       FROM projects p
       WHERE p.user_id = ? AND p.archived = 1
       ORDER BY p.archived_at DESC`,
      [userId]
    );
    res.json(projects);
  } catch (error) {
    console.error('Get archived projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ PROJECT SHARING ROUTES ============

// Share a project with another user by username
app.post('/api/projects/:id/share', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From authenticated token
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if requester owns the project (only owners can share)
    if (!req.isOwner) {
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
app.get('/api/projects/:id/shares', authenticateToken, checkProjectAccess, async (req, res) => {
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
app.delete('/api/projects/:id/shares/:shareUserId', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { id, shareUserId } = req.params;

    // Check if requester owns the project
    if (!req.isOwner) {
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

// Get all sections for a project (with creator info for shared projects)
app.get('/api/projects/:projectId/sections', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const sections = await dbAll(`
      SELECT s.*, u.username as created_by_username
      FROM sections s
      LEFT JOIN users u ON s.created_by_user_id = u.id
      WHERE s.project_id = ? AND s.archived = 0
      ORDER BY s.order_index ASC
    `, [projectId]);
    res.json(sections);
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new section
app.post('/api/sections', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const { projectId, name } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

    // Verify user has access to the project
    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);
    const share = !project && await dbGet('SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?', [projectId, userId]);
    if (!project && !share) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM sections WHERE project_id = ?',
      [projectId]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    const result = await dbRun(
      'INSERT INTO sections (project_id, name, order_index, created_by_user_id) VALUES (?, ?, ?, ?)',
      [projectId, name, orderIndex, userId]
    );

    // Get section with creator username
    const section = await dbGet(`
      SELECT s.*, u.username as created_by_username
      FROM sections s
      LEFT JOIN users u ON s.created_by_user_id = u.id
      WHERE s.id = ?
    `, [result.lastID]);

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
app.put('/api/sections/:id', authenticateToken, checkSectionAccess, async (req, res) => {
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
app.delete('/api/sections/:id', authenticateToken, checkSectionAccess, async (req, res) => {
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
app.post('/api/sections/reorder', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { sectionIds } = req.body;

    if (!sectionIds || !Array.isArray(sectionIds) || sectionIds.length === 0) {
      return res.status(400).json({ error: 'sectionIds array is required' });
    }

    // Verify all sections belong to projects the user has access to
    for (const sectionId of sectionIds) {
      const section = await dbGet('SELECT project_id FROM sections WHERE id = ?', [sectionId]);
      if (!section) {
        return res.status(404).json({ error: 'Section not found' });
      }

      const owned = await dbGet(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [section.project_id, userId]
      );
      const shared = !owned && await dbGet(
        'SELECT id FROM project_shares WHERE project_id = ? AND user_id = ?',
        [section.project_id, userId]
      );
      if (!owned && !shared) {
        return res.status(403).json({ error: 'Access denied to one or more sections' });
      }
    }

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
app.post('/api/sections/:id/archive', authenticateToken, checkSectionAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From authenticated token

    // Archive all completed tasks in this section
    await dbRun(
      'UPDATE tasks SET archived = 1, archived_by_user_id = ? WHERE section_id = ? AND completed = 1',
      [userId, id]
    );

    // Archive the section
    await dbRun('UPDATE sections SET archived = 1, archived_by_user_id = ? WHERE id = ?', [userId, id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Archive section error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unarchive section
app.post('/api/sections/:id/unarchive', authenticateToken, checkSectionAccess, async (req, res) => {
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

// Get all tasks for a section (excluding subtasks - they're fetched separately)
// Includes user attribution info for shared projects
app.get('/api/sections/:sectionId/tasks', authenticateToken, checkSectionAccess, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const tasks = await dbAll(`
      SELECT t.*,
        u1.username as created_by_username,
        u2.username as completed_by_username,
        u3.username as archived_by_username
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by_user_id = u1.id
      LEFT JOIN users u2 ON t.completed_by_user_id = u2.id
      LEFT JOIN users u3 ON t.archived_by_user_id = u3.id
      WHERE t.section_id = ? AND t.archived = 0 AND t.parent_task_id IS NULL
      ORDER BY t.order_index ASC
    `, [sectionId]);

    // Add subtask count for each task
    for (let task of tasks) {
      const subtaskCount = await dbGet(
        'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ?',
        [task.id]
      );
      task.subtask_count = subtaskCount.count;

      // Also get completed subtask count for progress tracking
      const completedSubtasks = await dbGet(
        'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ? AND completed = 1',
        [task.id]
      );
      task.completed_subtask_count = completedSubtasks.count;
    }

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const { sectionId, title, description, parent_task_id } = req.body;

    if (!sectionId || !title) {
      return res.status(400).json({ error: 'Section ID and title are required' });
    }

    // Verify user has access to the section's project
    const section = await dbGet('SELECT * FROM sections WHERE id = ?', [sectionId]);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [section.project_id, userId]);
    const share = !project && await dbGet('SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?', [section.project_id, userId]);
    if (!project && !share) {
      return res.status(403).json({ error: 'Access denied to this section' });
    }

    // Validate parent_task_id if provided
    if (parent_task_id) {
      const parentTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [parent_task_id]);
      if (!parentTask) {
        return res.status(400).json({ error: 'Parent task not found' });
      }
      // Prevent nesting beyond 2 levels (parent tasks cannot be subtasks)
      if (parentTask.parent_task_id) {
        return res.status(400).json({ error: 'Cannot create subtask of a subtask (max 2 levels)' });
      }
    }

    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM tasks WHERE section_id = ? AND archived = 0',
      [sectionId]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    const result = await dbRun(
      'INSERT INTO tasks (section_id, title, description, parent_task_id, order_index, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [sectionId, title, description || '', parent_task_id || null, orderIndex, userId]
    );

    // Get task with creator username
    const task = await dbGet(`
      SELECT t.*, u.username as created_by_username
      FROM tasks t
      LEFT JOIN users u ON t.created_by_user_id = u.id
      WHERE t.id = ?
    `, [result.lastID]);

    // Get subtask count
    const subtaskCount = await dbGet(
      'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ?',
      [result.lastID]
    );
    task.subtask_count = subtaskCount.count;

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
app.put('/api/tasks/:id', authenticateToken, checkTaskAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From authenticated token
    const { title, description, completed, programmatic_completion, parent_task_id } = req.body;

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
      // Set or clear completed_at timestamp and completed_by_user_id
      if (completed) {
        updates.push('completed_at = ?');
        params.push(new Date().toISOString());
        updates.push('completed_by_user_id = ?');
        params.push(userId || null);
      } else {
        updates.push('completed_at = NULL');
        updates.push('completed_by_user_id = NULL');
      }
    }
    if (programmatic_completion !== undefined) {
      updates.push('programmatic_completion = ?');
      params.push(programmatic_completion ? 1 : 0);
    }
    if (parent_task_id !== undefined) {
      // Validate parent_task_id if provided (allow null to remove parent)
      if (parent_task_id !== null) {
        const parentTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [parent_task_id]);
        if (!parentTask) {
          return res.status(400).json({ error: 'Parent task not found' });
        }
        // Prevent nesting beyond 2 levels
        if (parentTask.parent_task_id) {
          return res.status(400).json({ error: 'Cannot create subtask of a subtask (max 2 levels)' });
        }
        // Prevent circular references (task cannot be its own parent)
        if (parentTask.id == id) {
          return res.status(400).json({ error: 'Task cannot be its own parent' });
        }
      }
      updates.push('parent_task_id = ?');
      params.push(parent_task_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    await dbRun(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);

    // Get task with user attribution info
    const task = await dbGet(`
      SELECT t.*,
        u1.username as created_by_username,
        u2.username as completed_by_username
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by_user_id = u1.id
      LEFT JOIN users u2 ON t.completed_by_user_id = u2.id
      WHERE t.id = ?
    `, [id]);

    // Get subtask count
    const subtaskCount = await dbGet(
      'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ?',
      [id]
    );
    task.subtask_count = subtaskCount.count;

    // Invalidate task cache
    invalidateCache('tasks');

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single task by ID
app.get('/api/tasks/:id', authenticateToken, checkTaskAccess, async (req, res) => {
  try {
    const { id } = req.params;

    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get subtask count
    const subtaskCount = await dbGet(
      'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ?',
      [id]
    );
    task.subtask_count = subtaskCount.count;

    // Get completed subtask count
    const completedSubtasks = await dbGet(
      'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ? AND completed = 1',
      [id]
    );
    task.completed_subtask_count = completedSubtasks.count;

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all subtasks for a task
app.get('/api/tasks/:id/subtasks', authenticateToken, checkTaskAccess, async (req, res) => {
  try {
    const { id } = req.params;

    const subtasks = await dbAll(`
      SELECT t.*,
        u1.username as created_by_username,
        u2.username as completed_by_username
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by_user_id = u1.id
      LEFT JOIN users u2 ON t.completed_by_user_id = u2.id
      WHERE t.parent_task_id = ?
      ORDER BY t.order_index ASC
    `, [id]);

    res.json(subtasks);
  } catch (error) {
    console.error('Get subtasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a subtask (shortcut endpoint)
app.post('/api/tasks/:id/subtasks', authenticateToken, checkTaskAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From authenticated token
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verify parent task exists and is not itself a subtask
    const parentTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!parentTask) {
      return res.status(404).json({ error: 'Parent task not found' });
    }
    if (parentTask.parent_task_id) {
      return res.status(400).json({ error: 'Cannot create subtask of a subtask (max 2 levels)' });
    }

    // Get max order for subtasks of this parent
    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM tasks WHERE parent_task_id = ?',
      [id]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    const result = await dbRun(
      'INSERT INTO tasks (section_id, title, description, parent_task_id, order_index, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [parentTask.section_id, title, description || '', id, orderIndex, userId]
    );

    const subtask = await dbGet(`
      SELECT t.*, u.username as created_by_username
      FROM tasks t
      LEFT JOIN users u ON t.created_by_user_id = u.id
      WHERE t.id = ?
    `, [result.lastID]);

    // Invalidate caches
    invalidateCache('tasks');

    res.json(subtask);
  } catch (error) {
    console.error('Create subtask error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Archive task
app.post('/api/tasks/:id/archive', authenticateToken, checkTaskAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From authenticated token
    await dbRun('UPDATE tasks SET archived = 1, archived_at = ?, archived_by_user_id = ? WHERE id = ?', [new Date().toISOString(), userId, id]);

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
app.post('/api/tasks/:id/unarchive', authenticateToken, checkTaskAccess, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the task's section to calculate new order
    const task = await dbGet('SELECT section_id FROM tasks WHERE id = ?', [id]);

    const maxOrder = await dbGet(
      'SELECT MAX(order_index) as max FROM tasks WHERE section_id = ? AND archived = 0',
      [task.section_id]
    );
    const orderIndex = (maxOrder.max || 0) + 1;

    await dbRun('UPDATE tasks SET archived = 0, archived_at = NULL, completed = 0, completed_at = NULL, programmatic_completion = 0, order_index = ? WHERE id = ?', [orderIndex, id]);

    const updatedTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(updatedTask);
  } catch (error) {
    console.error('Unarchive task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get archived tasks for a project
app.get('/api/projects/:projectId/archived', authenticateToken, checkProjectAccess, async (req, res) => {
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
app.get('/api/projects/:projectId/archived-sections', authenticateToken, checkProjectAccess, async (req, res) => {
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
app.delete('/api/tasks/:id', authenticateToken, checkTaskAccess, async (req, res) => {
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
app.post('/api/tasks/:id/move', authenticateToken, checkTaskAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { sectionId, targetIndex } = req.body;

    // Validate target section exists and user has access
    const targetSection = await dbGet('SELECT project_id FROM sections WHERE id = ?', [sectionId]);
    if (!targetSection) {
      return res.status(404).json({ error: 'Target section not found' });
    }

    const targetOwned = await dbGet(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [targetSection.project_id, userId]
    );
    const targetShared = !targetOwned && await dbGet(
      'SELECT id FROM project_shares WHERE project_id = ? AND user_id = ?',
      [targetSection.project_id, userId]
    );
    if (!targetOwned && !targetShared) {
      return res.status(403).json({ error: 'Access denied to target section' });
    }

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
app.post('/api/tasks/reorder', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'taskIds array is required' });
    }

    // Verify all tasks belong to projects the user has access to
    for (const taskId of taskIds) {
      const task = await dbGet(
        `SELECT t.id, s.project_id
         FROM tasks t
         JOIN sections s ON t.section_id = s.id
         WHERE t.id = ?`,
        [taskId]
      );
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const owned = await dbGet(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [task.project_id, userId]
      );
      const shared = !owned && await dbGet(
        'SELECT id FROM project_shares WHERE project_id = ? AND user_id = ?',
        [task.project_id, userId]
      );
      if (!owned && !shared) {
        return res.status(403).json({ error: 'Access denied to one or more tasks' });
      }
    }

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
app.post('/api/tasks/:id/photos', authenticateToken, checkTaskAccess, upload.array('photos', 5), async (req, res) => {
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
app.get('/api/tasks/:id/photos', authenticateToken, checkTaskAccess, async (req, res) => {
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
app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get photo info to delete file
    const photo = await dbGet('SELECT * FROM task_photos WHERE id = ?', [id]);

    if (photo) {
      // Verify user has access to the task this photo belongs to
      const task = await dbGet(
        `SELECT t.*, s.project_id
         FROM tasks t
         JOIN sections s ON t.section_id = s.id
         WHERE t.id = ?`,
        [photo.task_id]
      );

      if (task) {
        const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [task.project_id, req.userId]);
        const share = !project && await dbGet('SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?', [task.project_id, req.userId]);
        if (!project && !share) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

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

// Authenticated file access endpoint (replaces static serving)
app.get('/api/files/:filename', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;

    // Find the photo and verify access
    const photo = await dbGet('SELECT * FROM task_photos WHERE filename = ?', [filename]);

    if (!photo) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify user has access to the task this photo belongs to
    const task = await dbGet(
      `SELECT t.*, s.project_id
       FROM tasks t
       JOIN sections s ON t.section_id = s.id
       WHERE t.id = ?`,
      [photo.task_id]
    );

    if (task) {
      const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [task.project_id, req.userId]);
      const share = !project && await dbGet('SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?', [task.project_id, req.userId]);
      if (!project && !share) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('File access error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ LABEL/TAG ROUTES ============

// Get all labels for a user
app.get('/api/users/:userId/labels', authenticateToken, verifyUserMatch, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const labels = await dbAll(
      'SELECT * FROM labels WHERE user_id = ? ORDER BY name ASC',
      [userId]
    );
    res.json(labels);
  } catch (error) {
    console.error('Get labels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new label
app.post('/api/labels', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // From authenticated token
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const labelColor = color || '#3B82F6'; // Default blue

    const result = await dbRun(
      'INSERT INTO labels (user_id, name, color) VALUES (?, ?, ?)',
      [userId, name, labelColor]
    );

    const label = await dbGet('SELECT * FROM labels WHERE id = ?', [result.lastID]);

    res.json(label);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Label with this name already exists' });
    }
    console.error('Create label error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a label
app.put('/api/labels/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From authenticated token
    const { name, color } = req.body;

    // Verify label belongs to user
    const existingLabel = await dbGet('SELECT * FROM labels WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existingLabel) {
      return res.status(404).json({ error: 'Label not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    await dbRun(`UPDATE labels SET ${updates.join(', ')} WHERE id = ?`, params);
    const label = await dbGet('SELECT * FROM labels WHERE id = ?', [id]);

    res.json(label);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Label with this name already exists' });
    }
    console.error('Update label error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a label
app.delete('/api/labels/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From authenticated token

    // Verify label belongs to user
    const existingLabel = await dbGet('SELECT * FROM labels WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existingLabel) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Delete label (task_labels will be cascade deleted)
    await dbRun('DELETE FROM labels WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete label error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all labels for a task (with label details)
app.get('/api/tasks/:id/labels', authenticateToken, checkTaskAccess, async (req, res) => {
  try {
    const { id } = req.params;

    const labels = await dbAll(
      `SELECT l.* FROM labels l
       INNER JOIN task_labels tl ON l.id = tl.label_id
       WHERE tl.task_id = ?
       ORDER BY l.name ASC`,
      [id]
    );

    res.json(labels);
  } catch (error) {
    console.error('Get task labels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a label to a task
app.post('/api/tasks/:taskId/labels/:labelId', authenticateToken, async (req, res) => {
  try {
    const { taskId, labelId } = req.params;

    // Verify task exists and user has access
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

    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [task.project_id, req.userId]);
    const share = !project && await dbGet('SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?', [task.project_id, req.userId]);
    if (!project && !share) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const label = await dbGet('SELECT * FROM labels WHERE id = ?', [labelId]);
    if (!label) {
      return res.status(404).json({ error: 'Label not found' });
    }

    // Add label to task
    await dbRun(
      'INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)',
      [taskId, labelId]
    );

    res.json({ success: true, label });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Label already added to this task' });
    }
    console.error('Add label to task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove a label from a task
app.delete('/api/tasks/:taskId/labels/:labelId', authenticateToken, async (req, res) => {
  try {
    const { taskId, labelId } = req.params;

    // Verify task exists and user has access
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

    const project = await dbGet('SELECT * FROM projects WHERE id = ? AND user_id = ?', [task.project_id, req.userId]);
    const share = !project && await dbGet('SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?', [task.project_id, req.userId]);
    if (!project && !share) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await dbRun(
      'DELETE FROM task_labels WHERE task_id = ? AND label_id = ?',
      [taskId, labelId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Remove label from task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.1', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
