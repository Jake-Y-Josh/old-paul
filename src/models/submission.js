const db = require('../database/db');
const logger = require('../utils/logger');

class Submission {
  constructor(data) {
    this.id = data.id;
    this.form_id = data.form_id;
    this.client_id = data.client_id;
    this.responses = data.responses || {};
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Count total submissions
   * @returns {Promise<number>} Total count of submissions
   */
  static async count() {
    try {
      const query = `SELECT COUNT(*) FROM form_submissions`;
      const result = await db.query(query);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error counting submissions:', error);
      return 0;
    }
  }

  /**
   * Get submissions by form ID
   * @param {number} formId - Form ID to get submissions for
   * @returns {Promise<Array>} Array of submissions
   */
  static async getByFormId(formId) {
    try {
      const query = `
        SELECT s.*, c.name as client_name, c.email as client_email 
        FROM form_submissions s
        LEFT JOIN clients c ON s.client_id = c.id
        WHERE s.form_id = $1
        ORDER BY s.created_at DESC
      `;
      
      const result = await db.query(query, [formId]);
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching submissions for form ${formId}:`, error);
      throw error;
    }
  }

  /**
   * Get all submissions with form and client details
   * @param {number} limit - Optional limit of submissions to return
   * @param {number} offset - Optional offset for pagination
   * @returns {Promise<Array>} Array of submissions with form and client details
   */
  static async getAll(limit = 20, offset = 0) {
    try {
      const query = `
        SELECT s.*, c.name as client_name, c.email as client_email, f.title as form_title
        FROM form_submissions s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN forms f ON s.form_id = f.id
        ORDER BY s.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      
      const result = await db.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting all submissions:', error);
      throw error;
    }
  }

  /**
   * Get recent submissions with form and client details
   * @param {number} limit - Number of recent submissions to return
   * @returns {Promise<Array>} Array of recent submissions
   */
  static async getRecent(limit = 5) {
    try {
      const query = `
        SELECT s.*, c.name as client_name, c.email as client_email, f.title as form_title
        FROM form_submissions s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN forms f ON s.form_id = f.id
        ORDER BY s.created_at DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching recent submissions:', error);
      throw error;
    }
  }

  /**
   * Create a new submission
   * @param {Object} data - Submission data
   * @returns {Promise<Object>} Created submission
   */
  static async create(data) {
    try {
      const query = `
        INSERT INTO form_submissions (form_id, client_id, responses)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      
      const values = [
        data.formId,
        data.clientId,
        data.responses
      ];
      
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating submission:', error);
      throw error;
    }
  }

  /**
   * Get total count of submissions
   * @returns {Promise<number>} Total count of submissions
   */
  static async getTotalCount() {
    try {
      const query = 'SELECT COUNT(*) FROM form_submissions';
      const result = await db.query(query);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting submission count:', error);
      throw error;
    }
  }

  /**
   * Get a submission by ID
   * @param {number} id - Submission ID
   * @returns {Promise<Object>} Submission object
   */
  static async getById(id) {
    try {
      const query = `
        SELECT s.*, c.name as client_name, c.email as client_email, f.title as form_title, f.questions
        FROM form_submissions s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN forms f ON s.form_id = f.id
        WHERE s.id = $1
      `;
      
      const result = await db.query(query, [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error getting submission by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a submission
   * @param {number} id - Submission ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async delete(id) {
    try {
      const query = 'DELETE FROM form_submissions WHERE id = $1 RETURNING *';
      const result = await db.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error deleting submission ${id}:`, error);
      throw error;
    }
  }
}

module.exports = Submission; 