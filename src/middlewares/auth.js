/**
 * Authentication middleware to protect admin routes
 */

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  console.log('[Auth Middleware] Checking authentication...');
  console.log('[Auth Middleware] Session ID:', req.session.id);
  console.log('[Auth Middleware] Admin ID:', req.session.adminId);
  
  if (req.session && req.session.adminId) {
    console.log('[Auth Middleware] User is authenticated');
    return next();
  }
  
  // If not authenticated, redirect to login page
  console.log('[Auth Middleware] User is not authenticated, redirecting to login');
  res.redirect('/admin/login');
};

// Check if user is NOT authenticated (for login page)
const isNotAuthenticated = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }
  
  next();
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated
}; 