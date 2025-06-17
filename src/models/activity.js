const db = require('../database/db');
const logger = require('../utils/logger');

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
      // Query to get recent activities
      const query = `
        SELECT a.*, u.username 
        FROM activities a
        LEFT JOIN admins u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);
      
      // If no activities exist yet, return empty array
      if (result.rows.length === 0) {
        return [];
      }

      // Format activities with time ago
      return result.rows.map(row => {
        const timeAgo = this.getTimeAgo(row.created_at);
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          timeAgo,
          username: row.username
        };
      });
    } catch (error) {
      logger.error('Error fetching recent activities:', error);
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
      const query = `
        INSERT INTO activities (type, title, description, user_id, related_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        data.type,
        data.title,
        data.description,
        data.userId || null,
        data.relatedId || null
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error logging activity:', error);
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