// Use Supabase client instead of raw PostgreSQL
const { supabase } = require('../database/supabase');
const bcrypt = require('bcrypt');

class Admin {
  // Get an admin by username
  static async getByUsername(username) {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username);
    
    if (error) {
      console.error('Error getting admin by username:', error);
      return null;
    }
    
    // Return null if no admin found, or the first admin if found
    return data && data.length > 0 ? data[0] : null;
  }

  // Get an admin by email
  static async getByEmail(email) {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email);
    
    if (error) {
      console.error('Error getting admin by email:', error);
      return null;
    }
    
    // Return null if no admin found, or the first admin if found
    return data && data.length > 0 ? data[0] : null;
  }

  // Create a new admin with invitation token
  static async createWithInvitation(username, email, invitationToken, invitationExpiry) {
    const { data, error } = await supabase
      .from('admins')
      .insert([
        {
          username,
          email,
          invitation_token: invitationToken,
          invitation_token_expiry: invitationExpiry,
          is_active: false,
          created_at: new Date()
        }
      ])
      .select();
    
    if (error) {
      console.error('Error creating admin with invitation:', error);
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  }

  // Create a new admin (legacy method for direct password setting)
  static async create(username, email, password) {
    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const { data, error } = await supabase
      .from('admins')
      .insert([
        {
          username,
          email,
          password_hash: passwordHash,
          is_active: true,
          created_at: new Date()
        }
      ])
      .select();
    
    if (error) {
      console.error('Error creating admin:', error);
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  }

  // Verify password
  static async verifyPassword(username, password) {
    const admin = await this.getByUsername(username);
    if (!admin) {
      return false;
    }
    
    return bcrypt.compare(password, admin.password_hash);
  }

  // Get all admins
  static async getAll() {
    const { data, error } = await supabase
      .from('admins')
      .select('id, username, email, created_at');
    
    if (error) {
      console.error('Error getting all admins:', error);
      return [];
    }
    
    return data;
  }
  
  // Set password reset token
  static async setResetToken(adminId, resetToken, resetTokenExpiry) {
    const { data, error } = await supabase
      .from('admins')
      .update({
        reset_token: resetToken,
        reset_token_expiry: new Date(resetTokenExpiry)
      })
      .eq('id', adminId)
      .select();
    
    if (error) {
      console.error('Error setting reset token:', error);
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  }
  
  // Find admin by reset token
  static async findByResetToken(resetToken) {
    const now = new Date();
    
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('reset_token', resetToken)
      .gt('reset_token_expiry', now.toISOString());
    
    if (error) {
      console.error('Error finding admin by reset token:', error);
      return null;
    }
    
    // Return null if no admin found, or the first admin if found
    return data && data.length > 0 ? data[0] : null;
  }
  
  // Update password and clear reset token
  static async updatePassword(adminId, newPasswordHash) {
    const { data, error } = await supabase
      .from('admins')
      .update({
        password_hash: newPasswordHash,
        reset_token: null,
        reset_token_expiry: null
      })
      .eq('id', adminId)
      .select();
    
    if (error) {
      console.error('Error updating password:', error);
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  }

  // Get an admin by ID
  static async getById(id) {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id);
    
    if (error) {
      console.error('Error getting admin by ID:', error);
      return null;
    }
    
    // Return null if no admin found, or the first admin if found
    return data && data.length > 0 ? data[0] : null;
  }

  // Find admin by invitation token
  static async findByInvitationToken(invitationToken) {
    const now = new Date();
    
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('invitation_token', invitationToken)
      .gt('invitation_token_expiry', now.toISOString());
    
    if (error) {
      console.error('Error finding admin by invitation token:', error);
      return null;
    }
    
    // Return null if no admin found, or the first admin if found
    return data && data.length > 0 ? data[0] : null;
  }

  // Accept invitation and set password
  static async acceptInvitation(adminId, newPasswordHash) {
    const { data, error } = await supabase
      .from('admins')
      .update({
        password_hash: newPasswordHash,
        invitation_token: null,
        invitation_token_expiry: null,
        is_active: true
      })
      .eq('id', adminId)
      .select();
    
    if (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  }
  
  // Update last login time
  static async updateLastLogin(adminId) {
    const { data, error } = await supabase
      .from('admins')
      .update({
        last_login: new Date()
      })
      .eq('id', adminId)
      .select();
    
    if (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  }
}

module.exports = Admin; 