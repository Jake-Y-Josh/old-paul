const db = require('../database/db');

class EmailLog {
  constructor(data) {
    this.id = data.id;
    this.to_email = data.to_email || data.recipient || data.email || '';
    this.subject = data.subject || '';
    this.message_id = data.message_id || data.messageId || '';
    this.status = data.status || 'pending';
    this.type = data.type || 'other';
    this.error = data.error || null;
    this.sent_at = data.sent_at || data.sentAt || new Date();
    this.opened = data.opened || false;
    this.opened_at = data.opened_at || null;
    this.clicked = data.clicked || false;
    this.clicked_at = data.clicked_at || null;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Get all email logs
   * @returns {Promise<Array>} Array of email logs
   */
  static async getAll() {
    try {
      console.log('Executing getAll query...');
      const query = `
        SELECT el.*, 
          c.name as client_name, 
          c.email as client_email,
          f.title as form_title
        FROM email_logs el
        LEFT JOIN clients c ON el.client_id = c.id
        LEFT JOIN forms f ON el.form_id = f.id
        ORDER BY el.sent_at DESC
      `;
      
      console.log('Query:', query);
      const result = await db.query(query);
      console.log('Query result:', result);
      
      // Process the results to ensure to_email is set
      return result.rows.map(log => {
        if (!log.to_email && log.client_email) {
          log.to_email = log.client_email;
        }
        return log;
      });
    } catch (error) {
      console.error('[ERROR] Error getting email logs:', error);
      return [];
    }
  }

  /**
   * Create a new email log entry
   * @param {Object} data - Email log data
   * @returns {Promise<Object>} Created email log
   */
  static async create(logData) {
    try {
      // Ensure to_email is set
      const toEmail = logData.to_email || logData.recipient || logData.email || '';
      if (!toEmail) {
        console.error('[ERROR] No recipient email provided for email log:', logData);
        throw new Error('Recipient email is required');
      }

      const query = `
        INSERT INTO email_logs (
          client_id, form_id, to_email, subject, message_id, 
          status, type, error, sent_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING *
      `;
      
      const params = [
        logData.client_id || null,
        logData.form_id || null,
        toEmail,
        logData.subject || '',
        logData.message_id || null,
        logData.status || 'unknown',
        logData.type || null,
        logData.error || null,
        logData.sent_at || new Date()
      ];
      
      const result = await db.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('[ERROR] Error creating email log:', error);
      throw error;
    }
  }

  /**
   * Count total email logs
   * @returns {Promise<number>} Total count of email logs
   */
  static async count() {
    try {
      const query = `SELECT COUNT(*) FROM email_logs`;
      const result = await db.query(query);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error counting email logs:', error);
      return 0;
    }
  }

  // Get email logs for a specific form
  static async getByFormId(formId) {
    const result = await db.query(`
      SELECT el.*, 
        c.name as client_name, 
        c.email as client_email
      FROM email_logs el
      LEFT JOIN clients c ON el.client_id = c.id
      WHERE el.feedback_form_id = $1
      ORDER BY el.sent_at DESC
    `, [formId]);
    return result.rows;
  }

  // Get email logs for a specific client
  static async getByClientId(clientId) {
    const result = await db.query(`
      SELECT el.*, 
        f.title as form_title
      FROM email_logs el
      LEFT JOIN forms f ON el.form_id = f.id
      WHERE el.client_id = $1
      ORDER BY el.sent_at DESC
    `, [clientId]);
    return result.rows;
  }

  // Get email logs with a specific status
  static async getByStatus(status) {
    const result = await db.query(`
      SELECT el.*, 
        c.name as client_name, 
        c.email as client_email,
        f.title as form_title
      FROM email_logs el
      LEFT JOIN clients c ON el.client_id = c.id
      LEFT JOIN forms f ON el.form_id = f.id
      WHERE el.status = $1
      ORDER BY el.sent_at DESC
    `, [status]);
    return result.rows;
  }

  // Get email logs by type
  static async getByType(type) {
    const result = await db.query(`
      SELECT el.*, 
        c.name as client_name, 
        c.email as client_email,
        f.title as form_title
      FROM email_logs el
      LEFT JOIN clients c ON el.client_id = c.id
      LEFT JOIN forms f ON el.form_id = f.id
      WHERE el.type = $1
      ORDER BY el.sent_at DESC
    `, [type]);
    return result.rows;
  }

  /**
   * Mark an email as opened by message ID
   * @param {string} messageId - The message ID of the email
   * @returns {Promise<boolean>} Whether the update was successful
   */
  static async markOpened(messageId) {
    try {
      console.log(`Marking email as opened: ${messageId}`);
      
      // Only update if not already marked as opened
      const query = `
        UPDATE email_logs 
        SET opened = TRUE, 
            opened_at = CURRENT_TIMESTAMP, 
            updated_at = CURRENT_TIMESTAMP
        WHERE message_id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [messageId]);
      
      if (result.rows.length > 0) {
        console.log(`Successfully marked email ${messageId} as opened`);
        return true;
      } else {
        console.log(`No email found with message ID: ${messageId}`);
        return false;
      }
    } catch (error) {
      console.error('[ERROR] Error marking email as opened:', error);
      return false;
    }
  }

  /**
   * Mark an email as clicked by message ID
   * @param {string} messageId - The message ID of the email
   * @returns {Promise<boolean>} Whether the update was successful
   */
  static async markClicked(messageId) {
    try {
      console.log(`Marking email as clicked: ${messageId}`);
      
      // Also mark as opened if not already opened
      const query = `
        UPDATE email_logs 
        SET clicked = TRUE, 
            clicked_at = CURRENT_TIMESTAMP, 
            opened = TRUE, 
            opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE message_id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [messageId]);
      
      if (result.rows.length > 0) {
        console.log(`Successfully marked email ${messageId} as clicked`);
        return true;
      } else {
        console.log(`No email found with message ID: ${messageId}`);
        return false;
      }
    } catch (error) {
      console.error('[ERROR] Error marking email as clicked:', error);
      return false;
    }
  }

  /**
   * Update email status based on webhook events
   * @param {string} messageId - The message ID of the email
   * @param {string} status - The new status to set
   * @returns {Promise<boolean>} Whether the update was successful
   */
  static async updateStatus(messageId, status) {
    try {
      console.log(`Updating email status to ${status}: ${messageId}`);
      
      let query = '';
      let params = [messageId];
      
      switch (status) {
        case 'delivered':
          query = `UPDATE email_logs SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE message_id = $1 RETURNING *`;
          break;
        case 'bounced':
          query = `UPDATE email_logs SET status = 'bounced', bounced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE message_id = $1 RETURNING *`;
          break;
        case 'complained':
          query = `UPDATE email_logs SET status = 'complained', complained_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE message_id = $1 RETURNING *`;
          break;
        case 'delayed':
          query = `UPDATE email_logs SET status = 'delayed', updated_at = CURRENT_TIMESTAMP WHERE message_id = $1 RETURNING *`;
          break;
        default:
          query = `UPDATE email_logs SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE message_id = $1 RETURNING *`;
          params.push(status);
      }
      
      const result = await db.query(query, params);
      
      if (result.rows.length > 0) {
        console.log(`Successfully updated email ${messageId} status to ${status}`);
        return true;
      } else {
        console.log(`No email found with message ID: ${messageId}`);
        return false;
      }
    } catch (error) {
      console.error(`[ERROR] Error updating email status to ${status}:`, error);
      return false;
    }
  }

  /**
   * Get recent email logs with client and form details
   * @param {number} limit - Maximum number of logs to return
   * @returns {Promise<Array>} Recent email logs with details
   */
  static async getRecentWithDetails(limit = 5) {
    try {
      const query = `
        SELECT el.*, 
          c.name as client_name, 
          c.email as client_email,
          f.title as form_title
        FROM email_logs el
        LEFT JOIN clients c ON el.client_id = c.id
        LEFT JOIN forms f ON el.form_id = f.id
        ORDER BY el.sent_at DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('[ERROR] Error getting recent email logs with details:', error);
      return [];
    }
  }

  /**
   * Check if there are any tracked emails (opened or clicked)
   * @returns {Promise<boolean>} True if at least one email has been opened or clicked
   */
  static async hasTrackedEmails() {
    try {
      const query = `
        SELECT COUNT(*) FROM email_logs 
        WHERE opened = TRUE OR clicked = TRUE
      `;
      
      const result = await db.query(query);
      const count = parseInt(result.rows[0].count, 10);
      return count > 0;
    } catch (error) {
      console.error('[ERROR] Error checking for tracked emails:', error);
      return false;
    }
  }

  /**
   * Count total opened emails
   * @returns {Promise<number>} Number of opened emails
   */
  static async countOpened() {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count FROM email_logs WHERE opened = TRUE
      `);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('[ERROR] Error counting opened emails:', error);
      return 0;
    }
  }

  /**
   * Count total clicked emails
   * @returns {Promise<number>} Number of clicked emails
   */
  static async countClicked() {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count FROM email_logs WHERE clicked = TRUE
      `);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('[ERROR] Error counting clicked emails:', error);
      return 0;
    }
  }
}

module.exports = EmailLog; 