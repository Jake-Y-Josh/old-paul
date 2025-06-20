require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const ejsLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');

// Import routes
const adminRoutes = require('./routes/adminRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const submissionRoutes = require('./routes/submissionRoutes');

// Import database
const db = require('./database/db');

// Create Express app
const app = express();

// Configure Cross-Origin Resource Sharing if needed
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate');
  next();
});

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
// Use a default session secret if not provided (for development only)
const sessionSecret = process.env.SESSION_SECRET || 'default_session_secret_should_be_changed';

const sessionConfig = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true, // Changed to true to ensure session IDs are assigned
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Added sameSite: 'lax' for better security
  }
};

console.log('Session configuration:', {
  secretConfigured: !!sessionSecret,
  cookieSettings: sessionConfig.cookie
});

app.use(session(sessionConfig));

// Debug session middleware to help troubleshoot sessions
app.use((req, res, next) => {
  console.log('Session ID:', req.session.id);
  if (req.path.includes('/admin/login') || req.session.adminId) {
    console.log('Session data:', req.session);
  }
  next();
});

// Flash messages middleware
app.use(flash());

// Admin layout middleware - ensures admin pages use admin layout
app.use('/admin', (req, res, next) => {
  res.locals.layout = 'layouts/admin';
  next();
});

// Create uploads directory if it doesn't exist
// Check if we're not in Vercel (which has a read-only filesystem)
if (!process.env.VERCEL) {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
}

// Initialize database connection
(async () => {
  try {
    await db.initDb();
    console.log('Database initialized successfully');
  } catch (dbError) {
    console.error('Warning: Database initialization failed:', dbError);
    console.log('Application will start with limited functionality');
  }
})();

// Test endpoint to verify deployment and database connection
app.get('/test-db', async (req, res) => {
  console.log('=== TEST DATABASE CONNECTION ===');
  const results = {
    environment: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV,
    database_url: process.env.DATABASE_URL ? 'CONFIGURED' : 'NOT SET',
    session_secret: process.env.SESSION_SECRET ? 'CONFIGURED' : 'NOT SET',
    timestamp: new Date().toISOString()
  };
  
  try {
    // Test database connection
    const testQuery = await db.query('SELECT NOW() as current_time, version() as db_version');
    results.database = {
      connected: true,
      current_time: testQuery.rows[0].current_time,
      version: testQuery.rows[0].db_version
    };
    
    // Test admins table
    const adminCount = await db.query('SELECT COUNT(*) as count FROM admins');
    results.admins_count = adminCount.rows[0].count;
    
  } catch (error) {
    console.error('Database test error:', error);
    results.database = {
      connected: false,
      error: error.message,
      stack: error.stack
    };
  }
  
  res.json(results);
});

// Test endpoint to check admin accounts
app.get('/test-admins', async (req, res) => {
  console.log('=== TEST ADMIN ACCOUNTS ===');
  try {
    const admins = await db.query('SELECT id, username, email, created_at FROM admins ORDER BY id');
    res.json({
      success: true,
      count: admins.rows.length,
      admins: admins.rows.map(admin => ({
        id: admin.id,
        username: admin.username,
        email: admin.email,
        created_at: admin.created_at
      }))
    });
  } catch (error) {
    console.error('Admin test error:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Routes
app.use('/admin', adminRoutes);
app.use('/', feedbackRoutes);
app.use('/admin/submissions', submissionRoutes);

// Home route
app.get('/', (req, res) => {
  res.render('public/home', {
    title: 'Home',
    layout: false
  });
});

// Instructions route
app.get('/instructions', (req, res) => {
  res.render('public/instructions/index', {
    title: 'Instructions',
    layout: false
  });
});

// Error handling
app.use((req, res, next) => {
  const isAuthenticated = req.session && req.session.adminId ? true : false;
  res.status(404).render('public/error', {
    message: 'Page not found',
    isAuthenticated,
    layout: false
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Periodic cleanup of expired remember tokens (every 24 hours)
const RememberToken = require('./models/rememberToken');
setInterval(async () => {
  try {
    const deletedCount = await RememberToken.cleanupExpired();
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired remember tokens`);
    }
  } catch (error) {
    console.error('Error in remember token cleanup:', error);
  }
}, 24 * 60 * 60 * 1000); // 24 hours

// Start the server if not running in Vercel environment
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the app for Vercel
module.exports = app;
