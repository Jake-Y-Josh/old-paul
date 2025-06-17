const db = require('../database/db');
const logger = require('../utils/logger');

class Client {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.extra_data = data.extra_data || {};
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Count total clients
   * @returns {Promise<number>} Total count of clients
   */
  static async count() {
    try {
      const query = `SELECT COUNT(*) FROM clients`;
      const result = await db.query(query);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error counting clients:', error);
      return 0;
    }
  }

  // Create a new client
  static async create(clientData) {
    try {
      const query = `
        INSERT INTO clients (name, email, extra_data)
        VALUES ($1, $2, $3) RETURNING *
      `;
      
      const result = await db.query(query, [
        clientData.name,
        clientData.email,
        clientData.extraData || {}
      ]);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error in Client.create:', error);
      throw error;
    }
  }

  // Find client by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM clients WHERE id = $1';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error in Client.findById:', error);
      throw error;
    }
  }

  // Find client by email
  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM clients WHERE email = $1';
      const result = await db.query(query, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error in Client.findByEmail:', error);
      throw error;
    }
  }

  // Get all clients
  static async findAll() {
    try {
      const query = `
        SELECT * FROM clients
        ORDER BY created_at DESC
      `;
      const { rows } = await db.query(query);
      return rows;
    } catch (error) {
      console.error('[ERROR] Error in Client.findAll:', error);
      throw error;
    }
  }

  // Alias for findAll to maintain compatibility with existing code
  static async getAll() {
    return this.findAll();
  }

  // Find client by email alias
  static async getByEmail(email) {
    return this.findByEmail(email);
  }
  
  // Find client by id alias
  static async getById(id) {
    return this.findById(id);
  }

  // Update client
  static async update(id, updateData) {
    try {
      logger.info(`Attempting to update client ${id} with data:`, updateData);
      
      const allowedFields = ['name', 'email', 'extraData'];
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      // Build update query dynamically based on provided fields
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          // Convert extraData to extra_data for DB column naming
          const dbFieldName = key === 'extraData' ? 'extra_data' : key;
          updates.push(`${dbFieldName} = $${paramCount}`);
          values.push(value);
          paramCount++;
          logger.info(`Adding update for field ${dbFieldName} with value: ${value}`);
        }
      }
      
      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      // Add updated_at timestamp
      updates.push(`updated_at = NOW()`);
      
      // Add ID to values array
      values.push(id);
      
      const query = `
        UPDATE clients
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;
      
      logger.info(`Executing update query: ${query}`);
      logger.info(`With values: ${values.join(', ')}`);
      
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        logger.error(`No client found with ID ${id} or no changes were made`);
        throw new Error('Client not found or no changes made');
      }
      
      logger.info(`Successfully updated client ${id}:`, result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error in Client.update for client ${id}:`, error);
      throw error;
    }
  }

  // Delete client
  static async delete(id) {
    try {
      const query = 'DELETE FROM clients WHERE id = $1 RETURNING *';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Client not found');
      }
      
      return true;
    } catch (error) {
      logger.error('Error in Client.delete:', error);
      throw error;
    }
  }

  // Find client by clientId (stored in extra_data)
  static async findByClientId(clientId) {
    try {
      // Use a JSON query to find clients with the given clientId in extra_data
      const query = `
        SELECT * FROM clients
        WHERE extra_data->>'clientId' = $1
        LIMIT 1
      `;
      
      const result = await db.query(query, [clientId.toString()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error in Client.findByClientId:', error);
      throw error;
    }
  }

  // Bulk upsert clients (update if exists, insert if new)
  static async bulkUpsert(clients) {
    try {
      const results = [];
      
      // Process each client
      for (const clientData of clients) {
        // Normalize email (lowercase)
        const email = clientData.email.toLowerCase();
        let existingClient = null;
        
        // Check if client with this client ID already exists (if client ID is provided)
        if (clientData.extraData && clientData.extraData.clientId) {
          existingClient = await this.findByClientId(clientData.extraData.clientId);
        }
        
        // If not found by client ID, try by email
        if (!existingClient) {
          existingClient = await this.findByEmail(email);
        }
        
        if (existingClient) {
          // Update existing client
          const updatedClient = await this.update(existingClient.id, {
            name: clientData.name,
            extraData: { 
              ...existingClient.extra_data,
              ...clientData.extraData 
            }
          });
          
          if (updatedClient) {
            results.push({
              id: updatedClient.id,
              name: updatedClient.name,
              email: updatedClient.email,
              action: 'updated'
            });
          }
        } else {
          // Create new client
          const newClient = await this.create({
            name: clientData.name,
            email: email,
            extraData: clientData.extraData || {}
          });
          
          if (newClient) {
            results.push({
              id: newClient.id,
              name: newClient.name,
              email: newClient.email,
              action: 'created'
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Error in Client.bulkUpsert:', error);
      throw error;
    }
  }
}

module.exports = Client; 