const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../database/db');

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
    const { username, email, password, confirm_password } = req.body;
    
    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
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
    
    // Create new user
    await Admin.create(username, email, password);
    
    // Log activity
    if (req.session && req.session.adminId) {
      const Activity = require('../models/activity');
      await Activity.log({
        admin_id: req.session.adminId,
        action: 'create_user',
        details: `Created new user: ${username}`,
        ip_address: req.ip
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      redirect: '/admin/users?success=User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
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
    
    // Update the user in the database - only updating the email for now
    const result = await db.query(
      'UPDATE admins SET email = $1 WHERE id = $2 RETURNING *',
      [email, userId]
    );
    
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
    
    // Delete the user
    await db.query('DELETE FROM admins WHERE id = $1', [userId]);
    
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

module.exports = {
  listUsers,
  createUserPage,
  createUser,
  editUserPage,
  updateUser,
  deleteUser
}; 