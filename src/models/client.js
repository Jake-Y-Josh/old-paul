const { supabase } = require('../database/supabase');
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
      const { count, error } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        logger.error('Error counting clients:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Error counting clients:', error);
      return 0;
    }
  }

  // Create a new client
  static async create(clientData) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([
          {
            name: clientData.name,
            email: clientData.email,
            extra_data: clientData.extraData || {}
          }
        ])
        .select()
        .single();
      
      if (error) {
        logger.error('Error in Client.create:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Error in Client.create:', error);
      throw error;
    }
  }

  // Find client by ID
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows found
        }
        logger.error('Error in Client.findById:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Error in Client.findById:', error);
      throw error;
    }
  }

  // Find client by email
  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows found
        }
        logger.error('Error in Client.findByEmail:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Error in Client.findByEmail:', error);
      throw error;
    }
  }

  // Get all clients
  static async findAll() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[ERROR] Error in Client.findAll:', error);
        throw error;
      }
      
      return data || [];
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
      
      // Build update object
      const updateObject = {};
      
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          // Convert extraData to extra_data for DB column naming
          const dbFieldName = key === 'extraData' ? 'extra_data' : key;
          updateObject[dbFieldName] = value;
          logger.info(`Adding update for field ${dbFieldName} with value: ${value}`);
        }
      }
      
      if (Object.keys(updateObject).length === 0) {
        throw new Error('No valid fields to update');
      }
      
      // Add updated_at timestamp
      updateObject.updated_at = new Date();
      
      const { data, error } = await supabase
        .from('clients')
        .update(updateObject)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        logger.error(`Error updating client ${id}:`, error);
        throw error;
      }
      
      if (!data) {
        logger.error(`No client found with ID ${id} or no changes were made`);
        throw new Error('Client not found or no changes made');
      }
      
      logger.info(`Successfully updated client ${id}:`, data);
      return data;
    } catch (error) {
      logger.error(`Error in Client.update for client ${id}:`, error);
      throw error;
    }
  }

  // Delete client
  static async delete(id) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Client not found');
        }
        logger.error('Error in Client.delete:', error);
        throw error;
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
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('extra_data->>clientId', clientId.toString())
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows found
        }
        logger.error('Error in Client.findByClientId:', error);
        throw error;
      }
      
      return data;
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