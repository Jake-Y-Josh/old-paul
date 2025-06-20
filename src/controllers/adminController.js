const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/mailer');
const Form = require('../models/form');
const Client = require('../models/client');
const Submission = require('../models/submission');
const Email = require('../models/email');
const Activity = require('../models/activity');
const EmailLog = require('../models/emailLog');
const RememberToken = require('../models/rememberToken');
const { supabase } = require('../database/supabase');

/**
 * Admin Controller
 */

// Render login page
const loginPage = async (req, res) => {
  // Extract messages from flash
  const error = req.flash('error')[0] || null;
  
  // Check Supabase connection
  let supabaseStatus = 'Unknown';
  try {
    const { supabase } = require('../database/supabase');
    const { error } = await supabase.from('admins').select('count').limit(1);
    supabaseStatus = error ? 'Error: ' + error.message : 'Connected';
  } catch (err) {
    supabaseStatus = 'Error: ' + err.message;
  }
  
  // Add timestamp to prevent caching
  const timestamp = new Date().getTime();
  
  res.render('admin/login', {
    title: 'Admin Login',
    error,
    req,
    supabaseStatus,
    timestamp,
    layout: false
  });
};

// Process login attempt
const login = async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    
    // Check if login credentials are provided
    if (!username || !password) {
      req.flash('error', 'Please provide username and password');
      return res.redirect('/admin/login');
    }
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log(`Username: ${username}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`IP Address: ${req.ip}`);
    console.log(`User Agent: ${req.headers['user-agent']}`);
    console.log('>>> AUTHENTICATION METHOD: SUPABASE AUTH ONLY <<<');
    console.log('>>> Old session-based auth is DISABLED <<<');
    
    // Attempt to sign in with Supabase Auth
    // First, we need to check if the user exists in the database to get their email
    let email = username;
    let admin = null;
    
    // Check if username is actually an email
    if (!username.includes('@')) {
      // It's a username, so we need to get the email from the database
      admin = await Admin.getByUsername(username);
      if (admin) {
        email = admin.email;
      } else {
        console.error(`LOGIN FAILED: username ${username} not found in database`);
        req.flash('error', 'Invalid username or password');
        return res.redirect('/admin/login');
      }
    }
    
    // Use Supabase Auth to sign in
    console.log(`>>> Attempting Supabase Auth login with email: ${email}`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (authError) {
      console.error('>>> SUPABASE AUTH FAILED:', authError.message);
      console.error('>>> Auth error details:', authError);
      req.flash('error', 'Invalid username or password');
      return res.redirect('/admin/login');
    }
    
    if (!authData || !authData.user) {
      console.error('No user data returned from Supabase Auth');
      req.flash('error', 'Authentication failed');
      return res.redirect('/admin/login');
    }
    
    // Get admin details from database
    if (!admin) {
      admin = await Admin.getByEmail(email);
    }
    
    if (!admin) {
      // User exists in Supabase Auth but not in our admins table
      console.error('User authenticated but not found in admins table');
      req.flash('error', 'Account not authorized for admin access');
      return res.redirect('/admin/login');
    }
    
    // Update last login time
    try {
      await Admin.updateLastLogin(admin.id);
    } catch (updateError) {
      console.error('Error updating last login:', updateError);
      // Continue with login even if last login update fails
    }
    
    // Store Supabase session info
    req.session.supabaseUserId = authData.user.id;
    req.session.supabaseAccessToken = authData.session.access_token;
    req.session.supabaseRefreshToken = authData.session.refresh_token;
    
    // Set session variables
    req.session.adminId = admin.id;
    req.session.username = admin.username;
    req.session.authenticated = true;
    req.session.loginTime = new Date().toISOString();
    
    // Handle "Remember Me" functionality
    if (rememberMe) {
      // Extend session to 30 days if "Remember Me" is checked
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      console.log('Remember Me checked: Session extended to 30 days');
    } else {
      // Default session duration (24 hours)
      req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
      console.log('Remember Me not checked: Session set to 24 hours');
    }
    
    // Force session save before redirect
    req.session.save(async (err) => {
      if (err) {
        console.error('Error saving session:', err);
        req.flash('error', 'Error with session. Please try again');
        return res.redirect('/admin/login');
      }
      
      // Generate remember token if "Remember Me" is checked
      if (rememberMe) {
        try {
          const token = await RememberToken.create(admin.id, 30); // Valid for 30 days
          // Set remember token cookie
          res.cookie('remember_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
          });
          console.log('Remember token created and set in cookie');
        } catch (tokenError) {
          console.error('Error creating remember token:', tokenError);
          // Continue with login even if token creation fails
        }
      }
      
      console.log('>>> LOGIN SUCCESSFUL <<<');
      console.log(`>>> User: ${username}`);
      console.log(`>>> Email: ${email}`);
      console.log(`>>> Supabase User ID: ${req.session.supabaseUserId}`);
      console.log(`>>> Admin ID: ${req.session.adminId}`);
      console.log(`>>> Authentication Method: SUPABASE AUTH`);
      console.log('>>> Redirecting to dashboard...');
      // Redirect to dashboard
      return res.redirect('/admin/dashboard');
    });
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'An error occurred during login');
    res.redirect('/admin/login');
  }
};

// Logout
const logout = async (req, res) => {
  // Sign out from Supabase Auth
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out from Supabase:', error);
    }
  } catch (supabaseError) {
    console.error('Supabase signOut error:', supabaseError);
  }
  
  // Clear remember token if it exists
  const rememberToken = req.cookies.remember_token;
  if (rememberToken) {
    try {
      await RememberToken.delete(rememberToken);
      res.clearCookie('remember_token');
      console.log('Remember token cleared on logout');
    } catch (error) {
      console.error('Error clearing remember token:', error);
    }
  }
  
  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/admin/login');
  });
};

// Render dashboard page
const dashboard = async (req, res) => {
  try {
    // Get admin data
    const admin = await Admin.getById(req.session.adminId);
    
    // Extract messages from flash
    const success = req.flash('success')[0] || null;
    const error = req.flash('error')[0] || null;
    
    // Default stats object
    const stats = {
      totalForms: 0,
      totalClients: 0,
      totalSubmissions: 0,
      totalEmails: 0
    };
    
    // Try to get real stats
    try {
      if (typeof Form !== 'undefined' && Form.count) {
        stats.totalForms = await Form.count();
      }
      
      if (typeof Client !== 'undefined' && Client.count) {
        stats.totalClients = await Client.count();
      }
      
      if (typeof Submission !== 'undefined' && Submission.count) {
        stats.totalSubmissions = await Submission.count();
      }
      
      if (typeof Email !== 'undefined' && Email.count) {
        stats.totalEmails = await Email.count();
      }
    } catch (statsError) {
      console.error('Error fetching dashboard stats:', statsError);
      // Continue with default stats
    }
    
    // Get recent emails
    let recentEmails = [];

    try {
      if (typeof EmailLog !== 'undefined' && EmailLog.getRecentWithDetails) {
        recentEmails = await EmailLog.getRecentWithDetails(4);
      }
    } catch (emailsError) {
      console.error('Error fetching recent emails:', emailsError);
    }

    // Get recent submissions
    let recentSubmissions = [];

    try {
      if (typeof Submission !== 'undefined' && Submission.getRecent) {
        recentSubmissions = await Submission.getRecent(5);
      }
    } catch (submissionsError) {
      console.error('Error fetching recent submissions:', submissionsError);
    }

    // Get recent activity
    let recentActivity = [];
    
    try {
      if (typeof Activity !== 'undefined' && Activity.getRecent) {
        recentActivity = await Activity.getRecent(5);
      }
    } catch (activityError) {
      console.error('Error fetching recent activity:', activityError);
    }
    
    // Render dashboard
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      admin,
      stats,
      recentEmails,
      recentSubmissions,
      recentActivity,
      success,
      error,
      username: req.session.username
    });
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    req.flash('error', 'Failed to load dashboard');
    res.redirect('/admin/login');
  }
};

// Render forgot password page
const forgotPasswordPage = (req, res) => {
  res.render('admin/forgot-password', {
    title: 'Forgot Password',
    error: req.query.error,
    layout: false
  });
};

// Process forgot password request
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.redirect('/admin/forgot-password?error=Please provide your email address');
    }
    
    let actualEmail = email;
    
    // Check if input is a username instead of email
    if (!email.includes('@')) {
      // Try to find admin by username to get their email
      const admin = await Admin.getByUsername(email);
      if (admin) {
        actualEmail = admin.email;
        console.log(`Found admin by username: ${email}, using email: ${actualEmail}`);
      } else {
        // Don't reveal that the username doesn't exist
        return res.redirect('/admin/forgot-password?success=If your email exists in our system, you will receive password reset instructions');
      }
    }
    
    // Use Supabase Auth to send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(actualEmail, {
      redirectTo: `${req.protocol}://${req.get('host')}/admin/reset-password`
    });
    
    if (error) {
      console.error('Supabase password reset error:', error);
      // Don't reveal specific errors to prevent user enumeration
      return res.redirect('/admin/forgot-password?success=If your email exists in our system, you will receive password reset instructions');
    }
    
    console.log('Password reset email sent via Supabase Auth to:', actualEmail);
    
    res.redirect('/admin/forgot-password?success=Password reset instructions have been sent to your email');
  } catch (error) {
    console.error('Forgot password error:', error);
    console.error('Error stack:', error.stack);
    res.redirect('/admin/forgot-password?error=An error occurred, please try again');
  }
};

// Render reset password page
const resetPasswordPage = async (req, res) => {
  try {
    // For Supabase Auth, the reset token comes as a query parameter from the email link
    const { access_token, refresh_token, type } = req.query;
    
    if (type !== 'recovery' || !access_token) {
      return res.redirect('/admin/forgot-password?error=Invalid reset link');
    }
    
    res.render('admin/reset-password', {
      title: 'Reset Password',
      access_token,
      refresh_token,
      error: req.query.error,
      layout: false
    });
  } catch (error) {
    console.error('Reset password page error:', error);
    res.redirect('/admin/forgot-password?error=An error occurred');
  }
};

// Process reset password
const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, access_token } = req.body;
    
    if (!password || !confirmPassword) {
      return res.redirect(`/admin/reset-password?error=Please provide password and confirm password&access_token=${access_token}&type=recovery`);
    }
    
    if (password !== confirmPassword) {
      return res.redirect(`/admin/reset-password?error=Passwords do not match&access_token=${access_token}&type=recovery`);
    }
    
    if (!access_token) {
      return res.redirect('/admin/forgot-password?error=Invalid reset link');
    }
    
    // Use Supabase Auth to update the password
    const { error } = await supabase.auth.updateUser({
      password: password
    }, {
      accessToken: access_token
    });
    
    if (error) {
      console.error('Supabase password update error:', error);
      return res.redirect('/admin/forgot-password?error=Password reset link is invalid or has expired');
    }
    
    // Also update the password hash in our database for consistency
    try {
      // Get the user from the access token
      const { data: { user } } = await supabase.auth.getUser(access_token);
      if (user && user.email) {
        const admin = await Admin.getByEmail(user.email);
        if (admin) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await Admin.updatePassword(admin.id, hashedPassword);
        }
      }
    } catch (dbError) {
      console.error('Error updating database password:', dbError);
      // Continue anyway as Supabase Auth is the primary auth system
    }
    
    res.redirect('/admin/login?success=Your password has been reset successfully');
  } catch (error) {
    console.error('Reset password error:', error);
    res.redirect('/admin/forgot-password?error=An error occurred, please try again');
  }
};

// Register a new admin (protected admin function)
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if required fields are provided
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, and password'
      });
    }
    
    // Check if admin already exists
    const existingByUsername = await Admin.getByUsername(username);
    const existingByEmail = await Admin.getByEmail(email);
    
    if (existingByUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken'
      });
    }
    
    if (existingByEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Create user in Supabase Auth first
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm for admin-created users
      user_metadata: {
        username: username,
        created_by_admin: true
      }
    });
    
    if (authError) {
      console.error('Supabase Auth error:', authError);
      return res.status(400).json({
        success: false,
        message: 'Failed to create authentication account',
        error: authError.message
      });
    }
    
    // Create admin in our database
    const admin = await Admin.create(username, email, password);
    
    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register admin',
      error: error.message
    });
  }
};

module.exports = {
  loginPage,
  login,
  logout,
  dashboard,
  register,
  forgotPasswordPage,
  forgotPassword,
  resetPasswordPage,
  resetPassword
}; 