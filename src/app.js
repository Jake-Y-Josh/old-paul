const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const ejsLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
require('dotenv').config();

// Import routes
const adminRoutes = require('./routes/adminRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const testRoutes = require('./routes/testRoutes');

// Import database - use Supabase client
const db = require('./database/supabase');

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
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
// Use a default session secret if not provided (for development only)
const sessionSecret = process.env.SESSION_SECRET || 'default_session_secret_should_be_changed';

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true, // Changed to true to ensure session IDs are assigned
  cookie: {
    secure: process.env.NODE_ENV === 'production', 
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Added sameSite: 'lax' for better security
  }
}));

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

// Routes
app.use('/admin', adminRoutes);
app.use('/', feedbackRoutes);
app.use('/admin/submissions', submissionRoutes);
app.use('/', testRoutes);

// Home route
app.get('/', (req, res) => {
  res.render('public/home', {
    title: 'Home',
    layout: false
  });
});

// Debug session route (only in development or with DEBUG env var)
app.get('/debug-session', (req, res) => {
  // Only show debug info if in development or DEBUG is set
  if (process.env.NODE_ENV === 'production' && !process.env.DEBUG) {
    return res.redirect('/');
  }
  
  // Get relevant details without exposing sensitive info
  const sessionInfo = {
    id: req.session.id,
    cookie: req.session.cookie,
    adminId: req.session.adminId || 'Not set',
    username: req.session.username || 'Not set',
    authenticated: req.session.authenticated || false,
    env: process.env.NODE_ENV || 'development',
    session_name: process.env.SESS_NAME || 'default',
    has_session_secret: process.env.SESSION_SECRET ? true : false,
    session_secret_length: process.env.SESSION_SECRET ? process.env.SESSION_SECRET.length : 0,
    timestamp: new Date().toISOString()
  };
  
  res.json({
    message: 'Session debug information',
    supabase_url: process.env.SUPABASE_URL || 'Not set',
    session: sessionInfo
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

app.use((err, req, res, next) => {
  console.error(err.stack);
  const isAuthenticated = req.session && req.session.adminId ? true : false;
  res.status(500).render('public/error', {
    message: 'Something went wrong',
    error: process.env.NODE_ENV === 'development' ? err : {},
    isAuthenticated,
    layout: false
  });
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