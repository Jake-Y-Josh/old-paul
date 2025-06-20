/**
 * Authentication middleware to protect admin routes
 */
const RememberToken = require('../models/rememberToken');
const { supabase } = require('../database/supabase');

// Check if user is authenticated
const isAuthenticated = async (req, res, next) => {
  console.log('[Auth Middleware] === AUTHENTICATION CHECK ===');
  console.log('[Auth Middleware] Path:', req.path);
  console.log('[Auth Middleware] Method:', req.method);
  console.log('[Auth Middleware] Session ID:', req.session.id);
  console.log('[Auth Middleware] Admin ID:', req.session.adminId);
  console.log('[Auth Middleware] Has Supabase Token:', !!req.session.supabaseAccessToken);
  console.log('[Auth Middleware] >>> Using SUPABASE AUTH for validation <<<');
  
  if (req.session && req.session.adminId && req.session.supabaseAccessToken) {
    // Validate Supabase session
    try {
      const { data: { user }, error } = await supabase.auth.getUser(req.session.supabaseAccessToken);
      
      if (error || !user) {
        console.log('[Auth Middleware] Supabase session invalid:', error?.message);
        // Try to refresh the session
        if (req.session.supabaseRefreshToken) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
            refresh_token: req.session.supabaseRefreshToken
          });
          
          if (!refreshError && refreshData?.session) {
            // Update session with new tokens
            req.session.supabaseAccessToken = refreshData.session.access_token;
            req.session.supabaseRefreshToken = refreshData.session.refresh_token;
            console.log('[Auth Middleware] Supabase session refreshed successfully');
            return next();
          }
        }
        
        // Clear invalid session
        req.session.destroy();
        return res.redirect('/admin/login');
      }
      
      console.log('[Auth Middleware] User is authenticated via Supabase session');
      return next();
    } catch (error) {
      console.error('[Auth Middleware] Error validating Supabase session:', error);
      req.session.destroy();
      return res.redirect('/admin/login');
    }
  }
  
  // Check for remember token if no session
  const rememberToken = req.cookies.remember_token;
  if (rememberToken) {
    console.log('[Auth Middleware] Checking remember token...');
    try {
      const admin = await RememberToken.validateAndGetAdmin(rememberToken);
      if (admin) {
        console.log('[Auth Middleware] Remember token valid, auto-logging in user');
        // Create new session
        req.session.adminId = admin.id;
        req.session.username = admin.username;
        req.session.authenticated = true;
        req.session.loginTime = new Date().toISOString();
        req.session.autoLogin = true; // Flag to indicate auto-login
        
        // Save session and continue
        req.session.save((err) => {
          if (err) {
            console.error('[Auth Middleware] Error saving auto-login session:', err);
            res.clearCookie('remember_token');
            return res.redirect('/admin/login');
          }
          console.log('[Auth Middleware] Auto-login successful');
          return next();
        });
        return; // Important: return here to avoid double response
      } else {
        console.log('[Auth Middleware] Remember token invalid or expired');
        res.clearCookie('remember_token');
      }
    } catch (error) {
      console.error('[Auth Middleware] Error validating remember token:', error);
      res.clearCookie('remember_token');
    }
  }
  
  // If not authenticated, redirect to login page
  console.log('[Auth Middleware] User is not authenticated, redirecting to login');
  res.redirect('/admin/login');
};

// Check if user is NOT authenticated (for login page)
const isNotAuthenticated = async (req, res, next) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }
  
  // Check for remember token
  const rememberToken = req.cookies.remember_token;
  if (rememberToken) {
    console.log('[Auth Middleware] Found remember token on login page, checking validity...');
    try {
      const admin = await RememberToken.validateAndGetAdmin(rememberToken);
      if (admin) {
        console.log('[Auth Middleware] Remember token valid, auto-logging in and redirecting to dashboard');
        // Create new session
        req.session.adminId = admin.id;
        req.session.username = admin.username;
        req.session.authenticated = true;
        req.session.loginTime = new Date().toISOString();
        req.session.autoLogin = true;
        
        // Save session and redirect
        req.session.save((err) => {
          if (err) {
            console.error('[Auth Middleware] Error saving auto-login session:', err);
            res.clearCookie('remember_token');
            return next(); // Continue to login page if session save fails
          }
          console.log('[Auth Middleware] Auto-login successful, redirecting to dashboard');
          return res.redirect('/admin/dashboard');
        });
        return; // Important: return here to avoid calling next()
      } else {
        console.log('[Auth Middleware] Remember token invalid or expired, clearing cookie');
        res.clearCookie('remember_token');
      }
    } catch (error) {
      console.error('[Auth Middleware] Error validating remember token:', error);
      res.clearCookie('remember_token');
    }
  }
  
  next();
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated
}; 