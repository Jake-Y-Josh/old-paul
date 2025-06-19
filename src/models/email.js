const db = require('../database/db');
const logger = require('../utils/logger');

class Email {
  constructor(data) {
    this.id = data.id;
    this.to = data.to;
    this.subject = data.subject;
    this.body = data.body;
    this.status = data.status;
    this.sent_at = data.sent_at;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Count total emails
   * @returns {Promise<number>} Total count of emails
   */
  static async count() {
    try {
      const query = `SELECT COUNT(*) FROM email_logs`;
      const result = await db.query(query);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error counting emails:', error);
      return 0;
    }
  }

  /**
   * Get all email logs
   * @returns {Promise<Array>} Array of email logs
   */
  static async getLogs() {
    try {
      const query = `
        SELECT e.*
        FROM email_logs e
        ORDER BY e.sent_at DESC
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching email logs:', error);
      throw error;
    }
  }

  /**
   * Log an email
   * @param {Object} data - Email data
   * @returns {Promise<Object>} The created email log
   */
  static async log(data) {
    try {
      // Build the query with handling for missing fields
      let query = `
        INSERT INTO email_logs (
          client_id,
          form_id,
          to_email,
          subject,
          message_id,
          status,
          type,
          error,
          sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      // Set default values for any missing fields
      const values = [
        data.client_id || data.clientId || null,
        data.form_id || data.formId || null,
        data.to_email || data.recipient || data.to || '',
        data.subject || '',
        data.messageId || data.message_id || '',
        data.status || 'sent',
        data.type || 'other',
        data.error || null,
        data.sentAt || data.sent_at || new Date()
      ];
      
      // Execute the query
      const result = await db.query(query, values);
      
      if (result.rows && result.rows.length > 0) {
        logger.info(`Email log created: ${values[2]}, subject: ${values[3]}`);
        return result.rows[0];
      } else {
        // Fallback if the database insert fails
        logger.warn('Email log insert returned no rows, using fallback object');
        return {
          id: 0,
          client_id: values[0],
          form_id: values[1],
          to_email: values[2],
          subject: values[3],
          message_id: values[4],
          status: values[5],
          type: values[6],
          error: values[7],
          sent_at: values[8],
          created_at: new Date()
        };
      }
    } catch (error) {
      logger.error('Error logging email:', error);
      
      // Return a fallback object to prevent further errors
      return {
        id: 0,
        client_id: data.client_id || data.clientId || null,
        form_id: data.form_id || data.formId || null,
        to_email: data.to_email || data.recipient || data.to || '',
        subject: data.subject || '',
        message_id: data.messageId || data.message_id || '',
        status: 'error',
        type: data.type || 'other',
        error: error.message,
        sent_at: data.sentAt || data.sent_at || new Date(),
        created_at: new Date()
      };
    }
  }

  /**
   * Create and log a new email
   * @param {Object} emailData - Email data including recipient, subject
   * @returns {Promise<Object>} The created email log
   */
  static async create(emailData) {
    try {
      return await this.log(emailData);
    } catch (error) {
      logger.error('Error creating email:', error);
      throw error;
    }
  }
}

module.exports = Email; 