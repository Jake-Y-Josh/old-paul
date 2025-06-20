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
    const { data, error } = await supabase.from('admins').select('count').limit(1);
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
    console.log(`Session ID: ${req.session.id}`);
    console.log(`Session secret first 10 chars: ${process.env.SESSION_SECRET ? process.env.SESSION_SECRET.substring(0, 10) + '...' : 'not set'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`Database URL configured: ${process.env.DATABASE_URL ? 'YES' : 'NO'}`);
    console.log(`Request headers:`, req.headers);
    
    // Special handling for default admin account (skip Supabase auth)
    if (username === 'admin') {
      if (password === 'admin123') {
        console.log('Admin login successful using default credentials (skipping Supabase auth)');
        
        // Force session regeneration to prevent session fixation
        req.session.regenerate((err) => {
          if (err) {
            console.error('Error regenerating session:', err);
            req.flash('error', 'Session error. Please try again');
            return res.redirect('/admin/login');
          }
          
          // Set session variables after regeneration
          req.session.adminId = 1;
          req.session.username = 'admin';
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

          req.session.save(async (saveErr) => {
            if (saveErr) {
              console.error('Error saving session:', saveErr);
              req.flash('error', 'Error with session. Please try again');
              return res.redirect('/admin/login');
            }

            // Generate remember token if "Remember Me" is checked
            if (rememberMe) {
              try {
                const token = await RememberToken.create(1, 30); // Admin ID 1, valid for 30 days
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

            console.log('Session saved successfully. Session data:', JSON.stringify(req.session));
            console.log('Redirecting to dashboard.');
            return res.redirect('/admin/dashboard');
          });
        });

        return;
      }

      console.log('Admin login failed: incorrect password');
      req.flash('error', 'Invalid username or password');
      return res.redirect('/admin/login');
    }

    // Regular login process
    try {
      let admin = await Admin.getByUsername(username);

      // If not found by username, try by email
      if (!admin) {
        admin = await Admin.getByEmail(username);
        if (admin) {
          console.log(`Found admin by email: ${username}`);
        }
      }

      if (!admin) {
        console.error(`LOGIN FAILED: username/email ${username} not found in database`);
        req.flash('error', 'Invalid username or password');
        return res.redirect('/admin/login');
      }

      // Check password
      const passwordMatch = await bcrypt.compare(password, admin.password_hash);

      if (!passwordMatch) {
        console.error(`LOGIN FAILED: incorrect password for ${username}`);
        req.flash('error', 'Invalid username or password');
        return res.redirect('/admin/login');
      }

      // Update last login time
      try {
        await Admin.updateLastLogin(admin.id);
      } catch (updateError) {
        console.error('Error updating last login:', updateError);
        // Continue with login even if last login update fails
      }

      // Set session
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

        console.log(`Login successful for ${username}`);
        // Redirect to dashboard
        return res.redirect('/admin/dashboard');
      });
    } catch (adminError) {
      console.error('=== DATABASE ERROR DURING LOGIN ===');
      console.error('Error details:', adminError);
      console.error('Error stack:', adminError.stack);
      req.flash('error', 'Database error during login');
      return res.redirect('/admin/login');
    }
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'An error occurred during login');
    res.redirect('/admin/login');
  }
};

// Logout
const logout = async (req, res) => {
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
    
    // Check if admin exists with this email
    let admin = await Admin.getByEmail(email);
    
    // If not found by email, try by username
    if (!admin) {
      console.log(`Admin not found by email ${email}, attempting lookup by username.`);
      admin = await Admin.getByUsername(email);
      if (admin) {
        console.log(`Found admin by username: ${admin.username}`);
      }
    }

    if (!admin) {
      // Don't reveal that the email doesn't exist for security reasons
      return res.redirect('/admin/forgot-password?success=If your email exists in our system, you will receive password reset instructions');
    }
    
    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour
    
    // Save token to database
    await Admin.setResetToken(admin.id, resetToken, resetTokenExpiry);
    
    // Send password reset email
    const resetLink = `${req.protocol}://${req.get('host')}/admin/reset-password/${resetToken}`;
    
    console.log('Sending password reset email to:', admin.email);
    console.log('Reset link:', resetLink);
    
    const emailResult = await sendPasswordResetEmail({
      to: admin.email,
      resetLink,
      adminName: admin.username
    });
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return res.redirect('/admin/forgot-password?error=Failed to send password reset email. Please try again.');
    }
    
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
    const { token } = req.params;
    
    if (!token) {
      return res.redirect('/admin/forgot-password?error=Invalid reset token');
    }
    
    // Verify token exists and hasn't expired
    const admin = await Admin.findByResetToken(token);
    
    if (!admin) {
      return res.redirect('/admin/forgot-password?error=Invalid or expired reset token');
    }
    
    res.render('admin/reset-password', {
      title: 'Reset Password',
      token,
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
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    
    if (!password || !confirmPassword) {
      return res.redirect(`/admin/reset-password/${token}?error=Please provide password and confirm password`);
    }
    
    if (password !== confirmPassword) {
      return res.redirect(`/admin/reset-password/${token}?error=Passwords do not match`);
    }
    
    // Verify token is valid
    const admin = await Admin.findByResetToken(token);
    
    if (!admin || admin.reset_token_expiry < Date.now()) {
      return res.redirect('/admin/forgot-password?error=Password reset link is invalid or has expired');
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update password and clear reset token
    await Admin.updatePassword(admin.id, hashedPassword);
    
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
    
    // Create new admin
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