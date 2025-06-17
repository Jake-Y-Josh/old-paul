const db = require('../database/db');

class FeedbackForm {
  // Get a form by ID
  static async getById(id) {
    const result = await db.query(
      'SELECT * FROM forms WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  // Create a new feedback form
  static async create(title, content, createdBy) {
    const result = await db.query(
      'INSERT INTO forms (title, content, created_by) VALUES ($1, $2, $3) RETURNING *',
      [title, content, createdBy]
    );
    return result.rows[0];
  }

  // Update a feedback form
  static async update(id, title, content) {
    const result = await db.query(
      'UPDATE forms SET title = $1, content = $2 WHERE id = $3 RETURNING *',
      [title, content, id]
    );
    return result.rows[0];
  }

  // Get all feedback forms
  static async getAll() {
    const result = await db.query(`
      SELECT f.*, a.username as created_by_username 
      FROM forms f
      LEFT JOIN admins a ON f.created_by = a.id
      ORDER BY f.updated_at DESC
    `);
    return result.rows;
  }

  // Delete a feedback form
  static async delete(id) {
    const result = await db.query(
      'DELETE FROM forms WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Get forms created by a specific admin
  static async getByAdmin(adminId) {
    const result = await db.query(
      'SELECT * FROM forms WHERE created_by = $1 ORDER BY updated_at DESC',
      [adminId]
    );
    return result.rows;
  }
}

module.exports = FeedbackForm; 