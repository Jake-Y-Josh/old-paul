const db = require('../database/db');
const logger = require('../utils/logger');

class Form {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.questions = data.questions || [];
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Count total forms
   * @returns {Promise<number>} Total count of forms
   */
  static async count() {
    try {
      const query = `SELECT COUNT(*) FROM forms`;
      const result = await db.query(query);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error counting forms:', error);
      return 0;
    }
  }

  /**
   * Get all forms
   * @returns {Promise<Array>} Array of forms
   */
  static async getAll() {
    try {
      const query = `
        SELECT f.*, a.username as created_by_username
        FROM forms f
        LEFT JOIN admins a ON f.created_by = a.id
        ORDER BY f.created_at DESC
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching forms:', error);
      throw error;
    }
  }

  /**
   * Alias for getAll to maintain compatibility
   * @returns {Promise<Array>} Array of forms
   */
  static async findAll() {
    return this.getAll();
  }

  /**
   * Get a form by ID
   * @param {number} id - Form ID
   * @returns {Promise<Object>} Form data
   */
  static async getById(id) {
    try {
      const query = `
        SELECT f.*, a.username as created_by_username
        FROM forms f
        LEFT JOIN admins a ON f.created_by = a.id
        WHERE f.id = $1
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const form = result.rows[0];
      
      // Parse questions JSON data
      if (form.questions) {
        try {
          const questionsData = typeof form.questions === 'string' ? 
            JSON.parse(form.questions) : form.questions;
          
          // Handle both old and new data structures
          if (Array.isArray(questionsData)) {
            form.questions = questionsData;
            form.is_multi_step = false;
            form.steps = [];
          } else {
            form.questions = questionsData.questions || [];
            form.is_multi_step = questionsData.isMultiStep || false;
            form.steps = questionsData.steps || [];
          }
        } catch (error) {
          logger.error(`Error parsing questions JSON for form ${id}:`, error);
          form.questions = [];
          form.is_multi_step = false;
          form.steps = [];
        }
      } else {
        form.questions = [];
        form.is_multi_step = false;
        form.steps = [];
      }
      
      return form;
    } catch (error) {
      logger.error(`Error fetching form ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new form
   * @param {Object} formData - The form data
   * @param {number} createdBy - Admin ID who created the form
   * @returns {Promise<Object>} The created form
   */
  static async create(formData, createdBy) {
    try {
      // If we received old-style parameters (title, content, createdBy)
      if (typeof formData === 'string') {
        const title = formData;
        const content = arguments[1];
        createdBy = arguments[2];
        
        formData = {
          title,
          description: '',
          questions: JSON.parse(content)
        };
      }
      
      // Process multi-step form data
      const formQuestions = formData.questions || [];
      const isMultiStep = formData.isMultiStep || false;
      
      // Add step information to the form data if it's multi-step
      if (isMultiStep) {
        // Make sure each question has a step assigned
        formQuestions.forEach(question => {
          if (question.step === undefined) {
            question.step = 0;
          }
        });
        
        // Store steps information in the questions object
        formData.steps = formData.steps || [];
      }
      
      const query = `
        INSERT INTO forms (title, description, questions, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const values = [
        formData.title,
        formData.description || '',
        JSON.stringify({
          questions: formQuestions,
          isMultiStep: isMultiStep,
          steps: formData.steps || []
        }),
        createdBy
      ];
      
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating form:', error);
      throw error;
    }
  }

  /**
   * Update an existing form
   * @param {number} id - Form ID to update
   * @param {Object} formData - The updated form data
   * @returns {Promise<Object>} The updated form
   */
  static async update(id, formData) {
    try {
      // If we received old-style parameters (id, title, content)
      if (typeof formData === 'string') {
        const title = formData;
        const content = arguments[2];
        
        formData = {
          title,
          description: '',
          questions: typeof content === 'string' ? JSON.parse(content) : content
        };
      }
      
      // Process multi-step form data
      const formQuestions = formData.questions || [];
      const isMultiStep = formData.isMultiStep || false;
      
      // Add step information to the form data if it's multi-step
      if (isMultiStep) {
        // Make sure each question has a step assigned
        formQuestions.forEach(question => {
          if (question.step === undefined) {
            question.step = 0;
          }
        });
        
        // Store steps information in the questions object
        formData.steps = formData.steps || [];
      }
      
      const query = `
        UPDATE forms
        SET title = $1, 
            description = $2, 
            questions = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;
      
      const values = [
        formData.title,
        formData.description || '',
        JSON.stringify({
          questions: formQuestions,
          isMultiStep: isMultiStep,
          steps: formData.steps || []
        }),
        id
      ];
      
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Form not found');
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error updating form ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a form by ID
   * @param {number} id - Form ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async delete(id) {
    try {
      // First check if there are submissions associated with this form
      const submissionCheck = await db.query(
        `SELECT COUNT(*) FROM form_submissions WHERE form_id = $1`,
        [id]
      );
      
      const submissionCount = parseInt(submissionCheck.rows[0].count, 10);
      
      if (submissionCount > 0) {
        throw new Error(`Cannot delete form with ${submissionCount} associated submissions`);
      }
      
      // Delete the form if no submissions exist
      const result = await db.query(
        `DELETE FROM forms WHERE id = $1 RETURNING id`,
        [id]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error deleting form ${id}:`, error);
      throw error;
    }
  }
}

module.exports = Form; 