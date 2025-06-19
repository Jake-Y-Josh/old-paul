const { supabase } = require('../database/supabase');
const crypto = require('crypto');

/**
 * RememberToken Model
 * Manages persistent login tokens for "Remember Me" functionality
 */

class RememberToken {
  /**
   * Create a new remember token for an admin
   * @param {number} adminId - The admin ID
   * @param {number} daysValid - Number of days the token should be valid (default: 30)
   * @returns {Promise<string>} The generated token
   */
  static async create(adminId, daysValid = 30) {
    try {
      // Generate a secure random token
      const token = crypto.randomBytes(64).toString('hex');
      
      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysValid);
      
      // Insert into database
      const { data, error } = await supabase
        .from('remember_tokens')
        .insert({
          admin_id: adminId,
          token: token,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating remember token:', error);
        throw error;
      }
      
      console.log(`Remember token created for admin ${adminId}, expires: ${expiresAt}`);
      return token;
    } catch (error) {
      console.error('Error in RememberToken.create:', error);
      throw error;
    }
  }
  
  /**
   * Find and validate a remember token
   * @param {string} token - The token to validate
   * @returns {Promise<object|null>} Admin data if token is valid, null otherwise
   */
  static async validateAndGetAdmin(token) {
    try {
      // Find the token and join with admin data
      const { data, error } = await supabase
        .from('remember_tokens')
        .select(`
          id,
          admin_id,
          expires_at,
          admins (
            id,
            username,
            email
          )
        `)
        .eq('token', token)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (error || !data) {
        console.log('Remember token validation failed:', error?.message || 'Token not found or expired');
        return null;
      }
      
      console.log(`Remember token validated for admin ${data.admin_id}`);
      return data.admins;
    } catch (error) {
      console.error('Error in RememberToken.validateAndGetAdmin:', error);
      return null;
    }
  }
  
  /**
   * Delete a specific remember token
   * @param {string} token - The token to delete
   * @returns {Promise<boolean>} Success status
   */
  static async delete(token) {
    try {
      const { error } = await supabase
        .from('remember_tokens')
        .delete()
        .eq('token', token);
      
      if (error) {
        console.error('Error deleting remember token:', error);
        return false;
      }
      
      console.log('Remember token deleted successfully');
      return true;
    } catch (error) {
      console.error('Error in RememberToken.delete:', error);
      return false;
    }
  }
  
  /**
   * Delete all remember tokens for a specific admin
   * @param {number} adminId - The admin ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteAllForAdmin(adminId) {
    try {
      const { error } = await supabase
        .from('remember_tokens')
        .delete()
        .eq('admin_id', adminId);
      
      if (error) {
        console.error('Error deleting remember tokens for admin:', error);
        return false;
      }
      
      console.log(`All remember tokens deleted for admin ${adminId}`);
      return true;
    } catch (error) {
      console.error('Error in RememberToken.deleteAllForAdmin:', error);
      return false;
    }
  }
  
  /**
   * Clean up expired tokens (maintenance function)
   * @returns {Promise<number>} Number of tokens deleted
   */
  static async cleanupExpired() {
    try {
      const { data, error } = await supabase
        .from('remember_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select();
      
      if (error) {
        console.error('Error cleaning up expired tokens:', error);
        return 0;
      }
      
      const deletedCount = data ? data.length : 0;
      console.log(`Cleaned up ${deletedCount} expired remember tokens`);
      return deletedCount;
    } catch (error) {
      console.error('Error in RememberToken.cleanupExpired:', error);
      return 0;
    }
  }
}

module.exports = RememberToken;