const db = require('../database/db');

class FeedbackSubmission {
  // Get a submission by ID
  static async getById(id) {
    const result = await db.query(
      'SELECT * FROM form_submissions WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  // Create a new feedback submission
  static async create(clientId, feedbackFormId, responses) {
    // Ensure responses is properly formatted as JSON
    let jsonResponses;
    
    if (typeof responses === 'string') {
      try {
        // Validate it's proper JSON by parsing and re-stringifying
        JSON.parse(responses);
        jsonResponses = responses;
      } catch (e) {
        // If it's not valid JSON, wrap it as a JSON string
        jsonResponses = JSON.stringify({ raw: responses });
      }
    } else {
      // If it's already an object, stringify it
      jsonResponses = JSON.stringify(responses);
    }
    
    const result = await db.query(
      'INSERT INTO form_submissions (client_id, form_id, responses) VALUES ($1, $2, $3) RETURNING *',
      [clientId, feedbackFormId, jsonResponses]
    );
    return result.rows[0];
  }

  // Get all submissions for a specific form
  static async getByFormId(formId) {
    const result = await db.query(`
      SELECT fs.*, c.name as client_name, c.email as client_email
      FROM form_submissions fs
      JOIN clients c ON fs.client_id = c.id
      WHERE fs.form_id = $1
      ORDER BY fs.submitted_at DESC
    `, [formId]);
    return result.rows;
  }

  // Get all submissions from a specific client
  static async getByClientId(clientId) {
    const result = await db.query(`
      SELECT fs.*, f.title as form_title
      FROM form_submissions fs
      JOIN forms f ON fs.form_id = f.id
      WHERE fs.client_id = $1
      ORDER BY fs.submitted_at DESC
    `, [clientId]);
    return result.rows;
  }

  // Get all submissions with client and form details
  static async getAllWithDetails() {
    const result = await db.query(`
      SELECT fs.*, 
        c.name as client_name, 
        c.email as client_email,
        f.title as form_title
      FROM form_submissions fs
      JOIN clients c ON fs.client_id = c.id
      JOIN forms f ON fs.form_id = f.id
      ORDER BY fs.submitted_at DESC
    `);
    return result.rows;
  }

  // Check if a client has already submitted a specific form
  static async hasClientSubmitted(clientId, formId) {
    const result = await db.query(
      'SELECT COUNT(*) FROM form_submissions WHERE client_id = $1 AND form_id = $2',
      [clientId, formId]
    );
    return parseInt(result.rows[0].count) > 0;
  }
}

module.exports = FeedbackSubmission; 