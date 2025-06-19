const { supabase } = require('../database/supabase');

class Activity {
  constructor(data) {
    this.id = data.id;
    this.type = data.type;
    this.title = data.title;
    this.description = data.description;
    this.user_id = data.user_id;
    this.related_id = data.related_id;
    this.created_at = data.created_at;
  }

  /**
   * Get recent activities
   * @param {number} limit - Number of activities to retrieve
   * @returns {Promise<Array>} - Array of recent activities
   */
  static async getRecent(limit = 5) {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          admins!user_id(username)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching recent activities:', error);
        return [];
      }
      
      // If no activities exist yet, return empty array
      if (!data || data.length === 0) {
        return [];
      }

      // Format activities with time ago
      return data.map(row => {
        const timeAgo = this.getTimeAgo(row.created_at);
        return {
          id: row.id,
          action: row.action,
          entity_type: row.entity_type,
          details: row.details,
          timeAgo,
          username: row.admins?.username || 'Unknown'
        };
      });
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      return [];
    }
  }

  /**
   * Log a new activity
   * @param {Object} data - Activity data
   * @returns {Promise<Object>} - Created activity
   */
  static async log(data) {
    try {
      const activityData = {
        user_id: data.admin_id || data.user_id || null,
        action: data.action || 'unknown',
        entity_type: data.entity_type || 'system',
        entity_id: data.entity_id || null,
        details: data.details || null,
        created_at: new Date()
      };

      const { data: result, error } = await supabase
        .from('activities')
        .insert([activityData])
        .select()
        .single();

      if (error) {
        console.error('Error logging activity:', error);
        return null;
      }

      return result;
    } catch (error) {
      console.error('Error logging activity:', error);
      // Still return something so the app doesn't crash if activity logging fails
      return null;
    }
  }

  /**
   * Get formatted time ago string
   * @param {Date} date - Date to format
   * @returns {string} - Formatted time ago
   */
  static getTimeAgo(date) {
    const now = new Date();
    const activityDate = new Date(date);
    const diffInSeconds = Math.floor((now - activityDate) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    }

    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
  }
}

module.exports = Activity; 