const db = require('../database/db');
const logger = require('../utils/logger');

/**
 * Settings Model for managing application configuration
 */
class Settings {
  constructor(data) {
    this.id = data.id;
    this.key = data.key;
    this.value = data.value;
    this.description = data.description;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Get all settings
   * @returns {Promise<Array>} Array of all settings
   */
  static async getAll() {
    try {
      try {
        const query = `
          SELECT * FROM settings
          ORDER BY key ASC
        `;
        
        const result = await db.query(query);
        
        // Create a map for easy lookup
        const settingsMap = {};
        result.rows.forEach(row => {
          settingsMap[row.key] = row;
        });
        
        // Create a list of settings with fallbacks to env vars for empty values
        const processedSettings = [];
        
        // Process known settings first with proper fallbacks
        const knownSettings = [
          'EMAIL_FROM',
          'EMAIL_FROM_NAME',
          'EMAIL_REPLY_TO',
          'NOTIFICATION_EMAILS'
        ];
        
        // Add known settings with fallbacks
        knownSettings.forEach(key => {
          const setting = settingsMap[key];
          
          if (setting) {
            // Check if value is empty or just whitespace
            if (setting.value === null || setting.value === '' || setting.value.trim() === '') {
              // Use environment variable or default
              setting.value = process.env[key] || Settings.getDefaultValueForKey(key);
            }
            processedSettings.push(setting);
          } else {
            // Create a setting from environment variable
            processedSettings.push({
              id: `env-${key}`,
              key: key,
              value: process.env[key] || Settings.getDefaultValueForKey(key),
              description: Settings.getDescriptionForKey(key),
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        });
        
        // Add any other settings from the database
        Object.values(settingsMap).forEach(setting => {
          if (!knownSettings.includes(setting.key)) {
            processedSettings.push(setting);
          }
        });
        
        return processedSettings;
      } catch (dbError) {
        // If we get a "relation does not exist" error, use environment variables
        if (dbError.code === '42P01' || dbError.code === 'ECONNREFUSED') {
          logger.warn('Settings table does not exist or database not available. Using environment variables for all settings.');
          
          // Create mock settings objects from environment variables or defaults
          return [
            {
              id: 'env-1',
              key: 'EMAIL_FROM',
              value: process.env.EMAIL_FROM || 'feedback@dynamic-fp.co.uk',
              description: 'The email address that appears in the From field',
              created_at: new Date(),
              updated_at: new Date()
            },
            {
              id: 'env-2',
              key: 'EMAIL_FROM_NAME',
              value: process.env.EMAIL_FROM_NAME || 'Dynamic FP Feedback',
              description: 'The name that appears alongside the From email address',
              created_at: new Date(),
              updated_at: new Date()
            },
            {
              id: 'env-3',
              key: 'EMAIL_REPLY_TO',
              value: process.env.EMAIL_REPLY_TO || 'enquiries@dynamic-fp.co.uk',
              description: 'The reply-to email address for all emails',
              created_at: new Date(),
              updated_at: new Date()
            },
            {
              id: 'env-4',
              key: 'NOTIFICATION_EMAILS',
              value: process.env.NOTIFICATION_EMAILS || '',
              description: 'Email addresses to notify when a form is submitted (comma-separated for multiple)',
              created_at: new Date(),
              updated_at: new Date()
            }
          ];
        } else {
          throw dbError; // Re-throw other errors
        }
      }
    } catch (error) {
      logger.error('Error getting all settings:', error);
      return [];
    }
  }

  /**
   * Helper function to get default value for a key
   */
  static getDefaultValueForKey(key) {
    switch(key) {
      case 'EMAIL_FROM':
        return 'feedback@dynamic-fp.co.uk';
      case 'EMAIL_FROM_NAME':
        return 'Dynamic FP Feedback';
      case 'EMAIL_REPLY_TO':
        return 'enquiries@dynamic-fp.co.uk';
      case 'NOTIFICATION_EMAILS':
        return '';
      default:
        return '';
    }
  }
  
  /**
   * Helper function to get description for a key
   */
  static getDescriptionForKey(key) {
    switch(key) {
      case 'EMAIL_FROM':
        return 'The email address that appears in the From field';
      case 'EMAIL_FROM_NAME':
        return 'The name that appears alongside the From email address';
      case 'EMAIL_REPLY_TO':
        return 'The reply-to email address for all emails';
      case 'NOTIFICATION_EMAILS':
        return 'Email addresses to notify when a form is submitted (comma-separated for multiple)';
      default:
        return '';
    }
  }

  /**
   * Get a setting by key
   * @param {string} key - The setting key
   * @returns {Promise<string|null>} The setting value or null if not found
   */
  static async get(key) {
    try {
      // If we're in a sandbox environment, return the default value
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        return process.env[key] || this.getDefaultValueForKey(key);
      }

      const query = `
        SELECT * FROM settings
        WHERE key = $1
        LIMIT 1
      `;
      
      const result = await db.query(query, [key]);
      return result.rows.length > 0 ? result.rows[0].value : null;
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Fallback to environment variables or defaults
      return process.env[key] || this.getDefaultValueForKey(key);
    }
  }

  /**
   * Get multiple settings by keys
   * @param {Array<string>} keys - Array of setting keys
   * @returns {Promise<Object>} Object with settings as key-value pairs
   */
  static async getMultiple(keys) {
    try {
      // For sandbox environments, use defaults
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        const settings = {};
        keys.forEach(key => {
          settings[key] = process.env[key] || this.getDefaultValueForKey(key);
        });
        return settings;
      }

      const result = await db.query('SELECT * FROM settings WHERE id = 1');
      const settings = result.rows[0]?.settings || {};
      
      // Check for empty values and replace with environment variables
      keys.forEach(key => {
        // Use environment variables for null, empty or whitespace values
        if (!settings[key] || settings[key] === '' || settings[key].trim() === '') {
          settings[key] = process.env[key] || Settings.getDefaultValueForKey(key);
        }
      });
      
      return settings;
    } catch (error) {
      console.error('Error getting multiple settings:', error);
      
      // Last resort fallback
      const settings = {};
      keys.forEach(key => {
        settings[key] = process.env[key] || this.getDefaultValueForKey(key);
      });
      
      return settings;
    }
  }

  /**
   * Set a setting value
   * @param {string} key - The setting key
   * @param {string} value - The setting value
   * @param {string} [description] - Optional description
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  static async set(key, value, description = null) {
    try {
      // In sandbox environments, just pretend it worked
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        console.log(`[SANDBOX] Setting ${key}=${value} (${description})`);
        return true;
      }

      const query = `
        INSERT INTO settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key)
        DO UPDATE SET value = $2, description = $3, updated_at = NOW()
        RETURNING *
      `;
      
      await db.query(query, [key, value, description]);
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      // In sandbox environments, don't throw errors
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        return true;
      }
      throw error;
    }
  }

  /**
   * Delete a setting
   * @param {string} key - The setting key
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  static async delete(key) {
    try {
      // In sandbox environments, just pretend it worked
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        console.log(`[SANDBOX] Deleting setting ${key}`);
        return true;
      }

      const result = await db.query(
        `UPDATE settings
         SET settings = jsonb_delete_key(settings, $1)
         WHERE id = 1
         RETURNING settings`,
        [key]
      );
      return true;
    } catch (error) {
      console.error(`Error deleting setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Ensure settings table exists
   * @returns {Promise<boolean>} True if successful
   */
  static async ensureTableExists() {
    try {
      // In sandbox environments, just pretend it worked
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        console.log('[SANDBOX] Settings table existence check skipped');
        return true;
      }

      // Check if table exists
      const checkQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'settings'
        );
      `;
      
      const checkResult = await db.query(checkQuery);
      const tableExists = checkResult.rows[0].exists;
      
      if (!tableExists) {
        logger.info('Settings table does not exist. Creating it...');
        
        // Create settings table - matching our schema.sql file
        const createQuery = `
          CREATE TABLE IF NOT EXISTS settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(255) NOT NULL UNIQUE,
            value TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
        await db.query(createQuery);
        logger.info('Settings table created successfully');
      }
      
      return true;
    } catch (error) {
      logger.error('Error ensuring settings table exists:', error);
      // In sandbox environments, don't fail
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        return true;
      }
      return false;
    }
  }

  /**
   * Initialize default settings if they don't exist
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  static async initDefaults() {
    try {
      // In sandbox environments, just pretend it worked 
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        console.log('[SANDBOX] Using environment variables for settings');
        return true;
      }

      // Ensure settings table exists first
      await this.ensureTableExists();
      
      const defaults = [
        {
          key: 'EMAIL_FROM',
          value: process.env.EMAIL_FROM || 'feedback@dynamic-fp.co.uk',
          description: 'The email address that appears in the From field'
        },
        {
          key: 'EMAIL_FROM_NAME',
          value: process.env.EMAIL_FROM_NAME || 'Dynamic FP Feedback',
          description: 'The name that appears alongside the From email address'
        },
        {
          key: 'EMAIL_REPLY_TO',
          value: process.env.EMAIL_REPLY_TO || 'enquiries@dynamic-fp.co.uk',
          description: 'The reply-to email address for all emails'
        },
        {
          key: 'NOTIFICATION_EMAILS',
          value: process.env.NOTIFICATION_EMAILS || '',
          description: 'Email addresses to notify when a form is submitted (comma-separated for multiple)'
        }
      ];
      
      for (const setting of defaults) {
        try {
          // Only set if it doesn't already exist
          const exists = await this.get(setting.key);
          if (exists === null) {
            await this.set(setting.key, setting.value, setting.description);
          }
        } catch (error) {
          console.log(`Skipping setting ${setting.key} due to error:`, error.message);
        }
      }
      
      console.log('Default settings initialized');
      return true;
    } catch (error) {
      logger.error('Error initializing default settings:', error);
      // In sandbox, don't fail
      if (db.isSandboxEnvironment && db.isSandboxEnvironment()) {
        console.log('Using default settings from environment variables');
        return true;
      }
      return false;
    }
  }
}

module.exports = Settings;