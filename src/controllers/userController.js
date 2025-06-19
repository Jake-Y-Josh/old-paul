const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendInvitationEmail } = require('../utils/mailer');

/**
 * User Management Controller for admin panel
 */

// List all users (excluding default admin)
const listUsers = async (req, res) => {
  try {
    const admins = await Admin.getAll();
    
    // Filter out the default 'admin' user from the display list
    const filteredAdmins = admins.filter(admin => admin.username !== 'admin');
    
    res.render('admin/users/list', {
      title: 'User Management',
      users: filteredAdmins,
      success: req.query.success,
      error: req.query.error,
      username: req.session.username,
      currentUser: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.render('error', { 
      message: 'Failed to load user list',
      error,
      layout: false
    });
  }
};

// Render create user page
const createUserPage = (req, res) => {
  res.render('admin/users/create', {
    title: 'Create User',
    username: req.session.username,
    layout: 'layouts/admin'
  });
};

// Create a new user
const createUser = async (req, res) => {
  try {
    const { username, email } = req.body;
    
    // Validate inputs
    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Username and email are required'
      });
    }
    
    // Check if username already exists
    const existingUsername = await Admin.getByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }
    
    // Check if email already exists
    const existingEmail = await Admin.getByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiry = new Date();
    invitationExpiry.setHours(invitationExpiry.getHours() + 24); // 24 hours from now
    
    // Create new user with invitation token
    const newAdmin = await Admin.createWithInvitation(username, email, invitationToken, invitationExpiry);
    
    // Build invitation link
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const invitationLink = `${baseUrl}/admin/accept-invitation?token=${invitationToken}`;
    
    // Send invitation email
    const emailResult = await sendInvitationEmail({
      to: email,
      username: username,
      invitationLink: invitationLink
    });
    
    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'User created but failed to send invitation email. Please try resending the invitation.'
      });
    }
    
    // Log activity
    if (req.session && req.session.adminId) {
      const Activity = require('../models/activity');
      await Activity.log({
        admin_id: req.session.adminId,
        action: 'send_invitation',
        entity_type: 'user',
        entity_id: newAdmin?.id,
        details: `Sent invitation to new user: ${username} (${email})`
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      redirect: '/admin/users?success=Invitation sent successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invitation'
    });
  }
};

// Render edit user page
const editUserPage = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await Admin.getById(userId);
    
    if (!user) {
      return res.redirect('/admin/users?error=User not found');
    }
    
    // Prevent editing the default admin user
    if (user.username === 'admin') {
      return res.redirect('/admin/users?error=Cannot edit default admin user');
    }
    
    res.render('admin/users/edit', {
      title: 'Edit User',
      user,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error loading user:', error);
    res.redirect('/admin/users?error=Failed to load user');
  }
};

// Update a user
const updateUser = async (req, res) => {
  try {
    console.log('Update user request received:', {
      userId: req.params.id,
      body: req.body,
      method: req.method
    });
    
    const userId = req.params.id;
    const { email, current_password, new_password, confirm_password } = req.body;
    
    // Get current user
    const user = await Admin.getById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent updating the default admin user
    if (user.username === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify default admin user'
      });
    }
    
    // Check if email is being changed and if it already exists
    if (email !== user.email) {
      const existingEmail = await Admin.getByEmail(email);
      if (existingEmail && existingEmail.id !== parseInt(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }
    
    // Update the user's email using Supabase
    const { supabase } = require('../database/supabase');
    const { data: updateResult, error: updateError } = await supabase
      .from('admins')
      .update({ email: email })
      .eq('id', userId)
      .select();
    
    if (updateError) {
      console.error('Error updating user email:', updateError);
      throw updateError;
    }
    
    // If password should be updated too
    if (new_password && current_password) {
      // Verify current password
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
      
      if (new_password !== confirm_password) {
        return res.status(400).json({
          success: false,
          message: 'New passwords do not match'
        });
      }
      
      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(new_password, saltRounds);
      
      // Update password
      await Admin.updatePassword(userId, passwordHash);
    }
    
    // Log activity
    if (req.session && req.session.adminId) {
      const Activity = require('../models/activity');
      await Activity.log({
        admin_id: req.session.adminId,
        action: 'update_user',
        details: `Updated user: ${user.username}`,
        ip_address: req.ip
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      redirect: '/admin/users?success=User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
};

// Delete a user
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get user to be deleted
    const user = await Admin.getById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent deleting the default admin user
    if (user.username === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete default admin user'
      });
    }
    
    // Delete the user using Supabase
    const { supabase } = require('../database/supabase');
    const { error: deleteError } = await supabase
      .from('admins')
      .delete()
      .eq('id', userId);
    
    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      throw deleteError;
    }
    
    // Log activity
    if (req.session && req.session.adminId) {
      const Activity = require('../models/activity');
      await Activity.log({
        admin_id: req.session.adminId,
        action: 'delete_user',
        details: `Deleted user: ${user.username}`,
        ip_address: req.ip
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

// Render invitation acceptance page
const acceptInvitationPage = async (req, res) => {
  try {
    const token = req.query.token;
    
    if (!token) {
      return res.render('admin/accept-invitation', {
        title: 'Set Your Password',
        error: 'No invitation token provided',
        user: null,
        token: null
      });
    }
    
    // Find admin by invitation token
    const admin = await Admin.findByInvitationToken(token);
    
    if (!admin) {
      return res.render('admin/accept-invitation', {
        title: 'Set Your Password',
        error: 'Invalid or expired invitation token',
        user: null,
        token: null
      });
    }
    
    res.render('admin/accept-invitation', {
      title: 'Set Your Password',
      error: null,
      user: admin,
      token: token
    });
  } catch (error) {
    console.error('Error loading invitation page:', error);
    res.render('admin/accept-invitation', {
      title: 'Set Your Password',
      error: 'An error occurred while loading the invitation',
      user: null,
      token: null
    });
  }
};

// Accept invitation and set password
const acceptInvitation = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    
    // Validate inputs
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }
    
    // Validate password requirements
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])(?=.{8,})/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements'
      });
    }
    
    // Find admin by invitation token
    const admin = await Admin.findByInvitationToken(token);
    
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invitation token'
      });
    }
    
    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Accept invitation and set password
    await Admin.acceptInvitation(admin.id, passwordHash);
    
    // Log activity
    const Activity = require('../models/activity');
    await Activity.log({
      admin_id: admin.id,
      action: 'accept_invitation',
      entity_type: 'user',
      entity_id: admin.id,
      details: `User ${admin.username} accepted invitation and set password`
    });
    
    res.status(200).json({
      success: true,
      message: 'Password set successfully. You can now log in.',
      redirect: '/admin/login?success=Password set successfully. Please log in.'
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set password'
    });
  }
};

module.exports = {
  listUsers,
  createUserPage,
  createUser,
  editUserPage,
  updateUser,
  deleteUser,
  acceptInvitationPage,
  acceptInvitation
}; 