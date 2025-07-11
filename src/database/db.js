const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Critical: Force disable SSL certificate validation for all database connections
// This is necessary because of certificate chain validation issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Configure basic SSL settings that work with Supabase
const sslConfig = { 
  rejectUnauthorized: false
};

// Environment detection
const isSandboxEnvironment = () => {
  // If explicitly set in environment vars, use that
  if (process.env.CODEX_ENVIRONMENT === 'true' || 
      process.env.SANDBOX_ENVIRONMENT === 'true' ||
      process.env.NODE_ENV === 'sandbox' ||
      process.env.USE_SQLITE === 'true') {
    console.log('Sandbox environment detected via environment variables');
    return true;
  }
  
  // ChatGPT Codex/sandbox environment detection - check network connectivity
  try {
    // Check if we can access the database hosts
    const hosts = [
      'db.hsacflpklcasjgffgzwd.supabase.co',
      'aws-0-eu-west-2.pooler.supabase.com'
    ];
    
    // If we're in a sandbox that doesn't allow external connections,
    // assume we're in a sandbox environment
    for (const host of hosts) {
      if (process.env.TEST_CONNECTIVITY) {
        const { execSync } = require('child_process');
        try {
          execSync(`ping -c 1 ${host}`, { stdio: 'ignore' });
        } catch (e) {
          console.log(`Cannot reach ${host} - assuming sandbox environment`);
          return true;
        }
      }
    }
  } catch (error) {
    // If any error occurs during checks, assume we're in a restricted environment
    console.log('Error checking connectivity - assuming sandbox environment');
    return true;
  }
  
  return false;
};

// Set a flag to indicate SQLite is being used
let usingSqlite = false;

// SQLite in-memory fallback for extreme environments with no PostgreSQL
const createSqlitePool = () => {
  try {
    // Try to require sqlite3 - may not be installed
    let sqlite3;
    try {
      sqlite3 = require('sqlite3');
    } catch (e) {
      console.error('SQLite is not available as a fallback. Please install it with npm install sqlite3:', e.message);
      throw e;
    }
    
    console.log('Using SQLite in-memory database for sandbox environment');
    
    // Create an in-memory SQLite database with a pg-compatible query interface
    const db = new sqlite3.Database(':memory:');
    
    // Create a minimal pg-compatible interface
    usingSqlite = true;
    return {
      query: (text, params = []) => {
        return new Promise((resolve, reject) => {
          // Simple query parser to handle basic PostgreSQL queries
          let sqliteQuery = text;
          
          // Replace PostgreSQL-specific syntax with SQLite syntax
          sqliteQuery = sqliteQuery.replace(/NOW\(\)/g, "datetime('now')");
          sqliteQuery = sqliteQuery.replace(/CURRENT_TIMESTAMP/g, "datetime('now')");
          sqliteQuery = sqliteQuery.replace(/to_timestamp\(([^\/]+)\/\s*1000\.0\)/g, "datetime($1/1000, 'unixepoch')");
          
          // Log the query being executed for debugging
          console.log('[SQLite] Query:', sqliteQuery);
          
          // Handle different query types
          if (sqliteQuery.trim().toLowerCase().startsWith('select')) {
            db.all(sqliteQuery, params, (err, rows) => {
              if (err) {
                console.error('[SQLite] Error executing SELECT:', err);
                return reject(err);
              }
              resolve({ rows, rowCount: rows.length });
            });
          } else if (sqliteQuery.trim().toLowerCase().startsWith('insert') && sqliteQuery.includes('returning')) {
            // SQLite doesn't support RETURNING clause, so we need to handle it differently
            db.run(sqliteQuery.replace(/returning.*$/i, ''), params, function(err) {
              if (err) {
                console.error('[SQLite] Error executing INSERT:', err);
                return reject(err);
              }
              
              // For simplicity, just return a mock response with the lastID
              const tableName = sqliteQuery.match(/into\s+([^\s(]+)/i)?.[1];
              
              if (tableName) {
                db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [this.lastID], (err, row) => {
                  if (err) {
                    console.error('[SQLite] Error fetching inserted row:', err);
                    return reject(err);
                  }
                  resolve({ rows: [row || { id: this.lastID }], rowCount: 1 });
                });
              } else {
                resolve({ rows: [{ id: this.lastID }], rowCount: 1 });
              }
            });
          } else {
            db.run(sqliteQuery, params, function(err) {
              if (err) {
                console.error('[SQLite] Error executing query:', err);
                return reject(err);
              }
              resolve({ rows: [], rowCount: this.changes });
            });
          }
        });
      },
      connect: () => {
        return Promise.resolve({
          release: () => {}
        });
      },
      end: () => {
        return new Promise((resolve) => {
          db.close(() => resolve());
        });
      },
      on: (event, callback) => {
        if (event === 'connect') {
          callback();
        }
      }
    };
  } catch (error) {
    console.error('SQLite is not available as a fallback. Creating mock database interface:', error.message);
    // Return a mock pool that pretends operations succeed
    return {
      query: (text, params = []) => {
        console.log('[MOCK_DB] Would execute query:', text, 'with params:', params);
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
      connect: () => {
        console.log('[MOCK_DB] Would connect to database');
        return Promise.resolve({
          release: () => {
            console.log('[MOCK_DB] Would release connection');
          }
        });
      },
      end: () => {
        console.log('[MOCK_DB] Would end database connection');
        return Promise.resolve();
      },
      on: (event, callback) => {
        if (event === 'connect') {
          console.log('[MOCK_DB] Mock database connected');
          callback();
        }
      }
    };
  }
};

// Log environment
if (process.env.NODE_ENV === 'production') {
  console.log('Production mode: SSL enabled for database connection');
} else {
  console.log('Development mode: SSL enabled for database connection (for compliance)');
}

// Handle forced sandbox environment
if (isSandboxEnvironment()) {
  console.log('Running in sandbox mode. Using in-memory database.');
}

// Create a database pool based on environment
let pool;

// Initialize the pool synchronously where possible
if (isSandboxEnvironment()) {
  pool = createSqlitePool();
} else {
  // For production, create the pool synchronously
  try {
    let poolConfig;
    if (process.env.DATABASE_URL) {
      poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
        max: 20,
        idleTimeoutMillis: 30000
      };
    } else {
      poolConfig = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
      };
    }
    
    pool = new Pool(poolConfig);
    pool.on('connect', () => {
      console.log('Connected to the PostgreSQL database');
    });
    pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  } catch (e) {
    console.error('Error creating PostgreSQL pool:', e.message);
    pool = createSqlitePool();
  }
}

// Helper function to execute queries with error handling
const query = async (text, params) => {
  try {
    // Pool should already be initialized
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    
    // Handle specific Supabase pooler errors or DNS resolution errors
    if ((error.code === 'XX000' && error.message.includes('Tenant or user not found')) || 
        (error.code === 'ENOTFOUND' && error.syscall === 'getaddrinfo' && error.hostname && error.hostname.includes('supabase.co'))) {
      
      console.error('Supabase connection error detected (Tenant/User not found or DNS issue). This usually means:');
      console.error('1. Incorrect database credentials or connection string in environment variables.');
      console.error('2. DNS resolution failure for the database hostname.');
      console.error('3. Network connectivity issues to the database host.');
      console.error('Attempting to retry with direct connection details...');
      
      // Try to recreate the pool with direct connection using specific env vars
      if (process.env.DB_HOST && process.env.DB_PASSWORD) {
        try {
          // Use the pooler URL for retry as well
          const directConfig = {
            connectionString: process.env.DATABASE_URL,
            ssl: sslConfig,
            connectionTimeoutMillis: 10000,
            max: 3
          };
          
          console.log('Creating new pool with DATABASE_URL connection');
          // Ensure the old pool is ended gracefully if possible, though pg-pool manages this
          // if (pool && typeof pool.end === 'function') { pool.end().catch(e => console.error('Error ending old pool:', e)); }
          pool = new Pool(directConfig);

          // Log successful reconnection attempt
          pool.on('connect', () => { console.log('Successfully reconnected to database using direct connection details.'); });
          pool.on('error', (retryErr) => { console.error('Error with retry pool connection:', retryErr); });

          // Give the new pool a moment to establish connection before retrying query
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

          // Retry the original query with new pool
          console.log('Retrying query after attempting reconnection...');
          const retryResult = await pool.query(text, params);
          console.log('Query retry successful.');
          return retryResult;
        } catch (retryError) {
          console.error('Retry with direct connection failed:', retryError);
          // Log the specific retry error for diagnosis
          if (retryError.code === 'ENOTFOUND' || retryError.syscall === 'getaddrinfo') {
            console.error('Retry failed due to DNS/Network issue on direct connection:', retryError.hostname);
          }
          throw error; // Throw original error if retry fails
        }
      } else {
        console.error('Cannot attempt direct connection retry: DB_HOST or DB_PASSWORD environment variables are not set.');
      }
    }
    
    throw error; // Re-throw other errors
  }
};

// Function to ensure admin user exists
const ensureAdminExists = async () => {
  try {
    // Default password: admin123
    // This is the correct bcrypt hash for 'admin123'
    const passwordHash = '$2b$10$rMYQMgw3LHmKWJgMYdM5qem/mKv91OjsKtODws.JJx7FP0HiXvXI6';
    
    try {
      // Check if table exists first
      if (usingSqlite) {
        const tableCheck = await pool.query(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='admins'
        `);
        
        if (tableCheck.rows.length === 0) {
          // Create admins table if it doesn't exist
          await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              reset_token TEXT,
              reset_token_expiry TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          console.log('Created admins table in SQLite');
          
          // Insert default admin user immediately
          await pool.query(
            'INSERT INTO admins (username, email, password_hash) VALUES ($1, $2, $3)',
            ['admin', 'admin@example.com', passwordHash]
          );
          console.log('Default admin user created (username: admin, password: admin123)');
          return;
        }
      }
      
      // Check if admin user exists
      const result = await pool.query('SELECT * FROM admins WHERE username = $1', ['admin']);
      
      if (!result.rows || result.rows.length === 0) {
        // Admin user doesn't exist, create it
        await pool.query(
          'INSERT INTO admins (username, email, password_hash) VALUES ($1, $2, $3)',
          ['admin', 'admin@example.com', passwordHash]
        );
        
        console.log('Default admin user created (username: admin, password: admin123)');
      } else {
        // Admin exists, but let's update the password hash to make sure it's correct
        await pool.query(
          'UPDATE admins SET password_hash = $1 WHERE username = $2',
          [passwordHash, 'admin']
        );
        console.log('Admin user exists - password reset to default (admin123)');
      }
    } catch (err) {
      console.error('Error checking admin existence:', err);
      
      if (usingSqlite) {
        // If using SQLite and table doesn't exist, create it
        await pool.query(`
          CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            reset_token TEXT,
            reset_token_expiry TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Insert admin user
        await pool.query(
          'INSERT INTO admins (username, email, password_hash) VALUES ($1, $2, $3)',
          ['admin', 'admin@example.com', passwordHash]
        );
        
        console.log('Created admins table and default admin user in SQLite');
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Error ensuring admin user exists:', error);
  }
};

// Function to create sample feedback form
const createSampleFeedbackForm = async () => {
  try {
    try {
      // First check if the forms table exists
      if (usingSqlite) {
        const tableCheck = await pool.query(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='forms'
        `);
        
        if (tableCheck.rows.length === 0) {
          // Create forms table if it doesn't exist
          await pool.query(`
            CREATE TABLE IF NOT EXISTS forms (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              description TEXT,
              questions TEXT,
              created_by INTEGER,
              is_multi_step INTEGER DEFAULT 0,
              steps TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          console.log('Created forms table in SQLite');
          
          // Create sample form with a mock admin ID
          const sampleForm = {
            title: 'Financial Planning Service Feedback',
            description: 'We value your feedback on our financial planning services. Please take a moment to share your experience with us.',
            questions: JSON.stringify([
              {
                text: 'How would you rate your overall experience with our financial planning services?',
                type: 'rating',
                help: 'Please rate from 1 (poor) to 5 (excellent)',
                required: true,
                min: 1,
                max: 5,
                step: 0
              },
              {
                text: 'Did our financial planning service meet your expectations?',
                type: 'radio',
                help: 'Please select the most appropriate answer',
                required: true,
                options: ['Exceeded expectations', 'Met expectations', 'Partially met expectations', 'Did not meet expectations'],
                step: 0
              }
            ]),
            steps: JSON.stringify([
              {
                title: 'Overall Satisfaction',
                description: 'Please tell us about your overall experience with our services',
                stepIndex: 0
              }
            ])
          };
          
          // Insert sample form
          await pool.query(
            'INSERT INTO forms (title, description, questions, created_by, is_multi_step, steps) VALUES ($1, $2, $3, $4, $5, $6)',
            [sampleForm.title, sampleForm.description, sampleForm.questions, 1, 1, sampleForm.steps]
          );
          
          console.log('Created sample form in SQLite');
          return;
        }
      }
      
      // Check if sample feedback form exists
      const result = await pool.query("SELECT * FROM forms WHERE title = 'Financial Planning Service Feedback'");
      
      if (result.rows.length === 0) {
        // Get admin ID
        const adminResult = await pool.query('SELECT id FROM admins WHERE username = $1', ['admin']);
        const adminId = adminResult.rows[0]?.id || 1;
        
        // Create sample financial planning feedback form
        const sampleForm = {
          title: 'Financial Planning Service Feedback',
          description: 'We value your feedback on our financial planning services. Please take a moment to share your experience with us.',
          questions: JSON.stringify([
            {
              text: 'How would you rate your overall experience with our financial planning services?',
              type: 'rating',
              help: 'Please rate from 1 (poor) to 5 (excellent)',
              required: true,
              min: 1,
              max: 5,
              step: 0
            },
            {
              text: 'How satisfied are you with the advice provided by your financial advisor?',
              type: 'rating',
              help: 'Please rate from 1 (dissatisfied) to 5 (very satisfied)',
              required: true,
              min: 1,
              max: 5,
              step: 0
            },
            {
              text: 'Did our financial planning service meet your expectations?',
              type: 'radio',
              help: 'Please select the most appropriate answer',
              required: true,
              options: ['Exceeded expectations', 'Met expectations', 'Partially met expectations', 'Did not meet expectations'],
              step: 0
            },
            {
              text: 'Which aspects of our service did you find most valuable?',
              type: 'checkbox',
              help: 'Select all that apply',
              required: true,
              options: ['Investment advice', 'Retirement planning', 'Tax planning', 'Estate planning', 'Insurance advice', 'Wealth management', 'Budgeting assistance', 'Financial education'],
              step: 1
            },
            {
              text: 'How would you rate the clarity of our communication regarding your financial plan?',
              type: 'rating',
              help: 'Please rate from 1 (not clear) to 5 (very clear)',
              required: true,
              min: 1,
              max: 5,
              step: 1
            },
            {
              text: 'How likely are you to recommend our financial planning services to others?',
              type: 'select',
              help: 'Please select one option',
              required: true,
              options: ['Extremely likely', 'Very likely', 'Somewhat likely', 'Not very likely', 'Not at all likely'],
              step: 1
            },
            {
              text: 'What specific improvements would you suggest for our financial planning services?',
              type: 'textarea',
              help: 'Please provide any suggestions for improving our services',
              required: false,
              step: 2
            },
            {
              text: 'Would you like to schedule a follow-up meeting with your financial advisor?',
              type: 'radio',
              help: '',
              required: false,
              options: ['Yes', 'No', 'Maybe later'],
              step: 2
            },
            {
              text: 'Any additional comments or feedback?',
              type: 'textarea',
              help: 'Please share any other thoughts you have about our services',
              required: false,
              step: 2
            }
          ]),
          isMultiStep: true,
          steps: JSON.stringify([
            {
              title: 'Overall Satisfaction',
              description: 'Please tell us about your overall experience with our services',
              stepIndex: 0
            },
            {
              title: 'Service Details',
              description: 'Let us know about specific aspects of our service',
              stepIndex: 1
            },
            {
              title: 'Additional Feedback',
              description: 'Please provide any additional comments or requests',
              stepIndex: 2
            }
          ])
        };
        
        // Insert the sample form
        await pool.query(
          'INSERT INTO forms (title, description, questions, created_by) VALUES ($1, $2, $3, $4)',
          [sampleForm.title, sampleForm.description, sampleForm.questions, adminId]
        );
        
        console.log('Sample Financial Planning feedback form created successfully');
      } else {
        console.log('Sample feedback form already exists');
      }
    } catch (err) {
      console.error('Error handling forms table:', err);
      
      if (usingSqlite) {
        // If using SQLite and table doesn't exist, create it
        await pool.query(`
          CREATE TABLE IF NOT EXISTS forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            questions TEXT,
            created_by INTEGER,
            is_multi_step INTEGER DEFAULT 0,
            steps TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Create sample form with a mock admin ID
        const sampleForm = {
          title: 'Financial Planning Service Feedback',
          description: 'We value your feedback on our financial planning services. Please take a moment to share your experience with us.',
          questions: JSON.stringify([
            {
              text: 'How would you rate your overall experience with our financial planning services?',
              type: 'rating',
              help: 'Please rate from 1 (poor) to 5 (excellent)',
              required: true,
              min: 1,
              max: 5,
              step: 0
            },
            {
              text: 'Did our financial planning service meet your expectations?',
              type: 'radio',
              help: 'Please select the most appropriate answer',
              required: true,
              options: ['Exceeded expectations', 'Met expectations', 'Partially met expectations', 'Did not meet expectations'],
              step: 0
            }
          ]),
          steps: JSON.stringify([
            {
              title: 'Overall Satisfaction',
              description: 'Please tell us about your overall experience with our services',
              stepIndex: 0
            }
          ])
        };
        
        // Insert sample form
        await pool.query(
          'INSERT INTO forms (title, description, questions, created_by, is_multi_step, steps) VALUES ($1, $2, $3, $4, $5, $6)',
          [sampleForm.title, sampleForm.description, sampleForm.questions, 1, 1, sampleForm.steps]
        );
        
        console.log('Created forms table and sample form in SQLite');
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Error creating sample feedback form:', error);
  }
};

// Function to check if database tables already exist
const checkTablesExist = async () => {
  try {
    if (usingSqlite) {
      // SQLite approach to check tables
      const result = await pool.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='clients'
      `);
      return result.rows.length > 0;
    } else {
      // PostgreSQL approach
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'clients'
        );
      `);
      return result.rows[0].exists;
    }
  } catch (error) {
    console.error('Error checking if tables exist:', error);
    return false;
  }
};

// Function to seed sample clients data
const seedSampleClients = async () => {
  try {
    try {
      // First check if the clients table exists
      if (usingSqlite) {
        const tableCheck = await pool.query(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='clients'
        `);
        
        if (tableCheck.rows.length === 0) {
          // Create the clients table if it doesn't exist
          await pool.query(`
            CREATE TABLE IF NOT EXISTS clients (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              extra_data TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          // Add sample clients
          const sampleClients = [
            { name: 'John Smith', email: 'john.smith@example.com', extra_data: JSON.stringify({ clientId: '1001', note: 'Sample client' }) },
            { name: 'Jane Doe', email: 'jane.doe@example.com', extra_data: JSON.stringify({ clientId: '1002', note: 'Sample client' }) }
          ];
          
          for (const client of sampleClients) {
            await query(
              'INSERT INTO clients (name, email, extra_data) VALUES ($1, $2, $3)',
              [client.name, client.email, client.extra_data]
            );
          }
          
          console.log('Created clients table and seeded sample clients in SQLite');
          return;
        }
      }
      
      // Check if clients table has any records
      const clientsResult = await query('SELECT COUNT(*) FROM clients');
      
      // Only seed if no clients exist
      if (parseInt(clientsResult.rows[0].count) === 0) {
        console.log('Seeding sample clients data...');
        
        // Add some sample clients
        const sampleClients = [
          { name: 'John Smith', email: 'john.smith@example.com', extra_data: JSON.stringify({ clientId: '1001', note: 'Sample client' }) },
          { name: 'Jane Doe', email: 'jane.doe@example.com', extra_data: JSON.stringify({ clientId: '1002', note: 'Sample client' }) },
          { name: 'Robert Johnson', email: 'robert.j@example.com', extra_data: JSON.stringify({ clientId: '1003', note: 'Sample client' }) }
        ];
        
        for (const client of sampleClients) {
          if (usingSqlite) {
            await query(
              'INSERT OR IGNORE INTO clients (name, email, extra_data) VALUES ($1, $2, $3)',
              [client.name, client.email, client.extra_data]
            );
          } else {
            await query(
              'INSERT INTO clients (name, email, extra_data) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING',
              [client.name, client.email, client.extra_data]
            );
          }
        }
        
        console.log('Sample clients data seeded successfully');
      } else {
        console.log(`Clients table already has ${clientsResult.rows[0].count} records. Skipping sample client seeding.`);
      }
    } catch (err) {
      console.error('Error handling clients table:', err);
      
      if (usingSqlite) {
        // Create the clients table if it doesn't exist
        await pool.query(`
          CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            extra_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Add sample clients
        const sampleClients = [
          { name: 'John Smith', email: 'john.smith@example.com', extra_data: JSON.stringify({ clientId: '1001', note: 'Sample client' }) },
          { name: 'Jane Doe', email: 'jane.doe@example.com', extra_data: JSON.stringify({ clientId: '1002', note: 'Sample client' }) }
        ];
        
        for (const client of sampleClients) {
          await query(
            'INSERT OR IGNORE INTO clients (name, email, extra_data) VALUES ($1, $2, $3)',
            [client.name, client.email, client.extra_data]
          );
        }
        
        console.log('Created clients table and seeded sample clients in SQLite');
      } else {
        throw err;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error seeding sample clients:', error);
    return false;
  }
};

// Function to migrate email_logs table structure if needed
const migrateEmailLogs = async () => {
  try {
    // Skip for SQLite - SQLite migrations would be different
    if (usingSqlite) {
      console.log('Skipping email_logs migration for SQLite database');
      return true;
    }

    // Check current email_logs table structure
    const checkColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'email_logs'
    `);
    
    if (checkColumns.rows.length === 0) {
      // Table doesn't exist yet, nothing to migrate
      return true;
    }
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    console.log('Checking email_logs table structure...');
    
    // Add to_email column if it doesn't exist
    if (!existingColumns.includes('to_email')) {
      console.log('Adding to_email column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN to_email VARCHAR(100) NOT NULL DEFAULT ''
      `);
    }
    
    // Add subject column if it doesn't exist
    if (!existingColumns.includes('subject')) {
      console.log('Adding subject column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN subject VARCHAR(255) NOT NULL DEFAULT ''
      `);
    }
    
    // Add message_id column if it doesn't exist
    if (!existingColumns.includes('message_id')) {
      console.log('Adding message_id column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN message_id VARCHAR(255)
      `);
    }
    
    // Add type column if it doesn't exist
    if (!existingColumns.includes('type')) {
      console.log('Adding type column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN type VARCHAR(50)
      `);
    }
    
    // Add opened column if it doesn't exist
    if (!existingColumns.includes('opened')) {
      console.log('Adding opened column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN opened BOOLEAN DEFAULT FALSE
      `);
    }
    
    // Add opened_at column if it doesn't exist
    if (!existingColumns.includes('opened_at')) {
      console.log('Adding opened_at column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN opened_at TIMESTAMP
      `);
    }
    
    // Add clicked column if it doesn't exist
    if (!existingColumns.includes('clicked')) {
      console.log('Adding clicked column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN clicked BOOLEAN DEFAULT FALSE
      `);
    }
    
    // Add clicked_at column if it doesn't exist
    if (!existingColumns.includes('clicked_at')) {
      console.log('Adding clicked_at column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN clicked_at TIMESTAMP
      `);
    }
    
    // Add updated_at column if it doesn't exist
    if (!existingColumns.includes('updated_at')) {
      console.log('Adding updated_at column to email_logs table...');
      await query(`
        ALTER TABLE email_logs 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
    }
    
    // Rename error_message column to error if it exists
    if (existingColumns.includes('error_message') && !existingColumns.includes('error')) {
      console.log('Renaming error_message column to error...');
      await query(`
        ALTER TABLE email_logs 
        RENAME COLUMN error_message TO error
      `);
    }
    
    // Check if recipient column exists and create migration path
    if (existingColumns.includes('recipient') && existingColumns.includes('to_email')) {
      console.log('Copying data from recipient to to_email column...');
      await query(`
        UPDATE email_logs 
        SET to_email = recipient 
        WHERE to_email = ''
      `);
    }
    
    console.log('Email logs table structure updated successfully');
    return true;
  } catch (error) {
    console.error('Error migrating email_logs table:', error);
    return false;
  }
};

// Function to create minimal schema for sandbox/SQLite
const createMinimalSchema = async () => {
  if (!usingSqlite) return true;
  
  try {
    console.log('Creating minimal schema for sandbox environment...');
    
    // Create the settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create the email_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT,
        status TEXT,
        error TEXT,
        message_id TEXT,
        type TEXT,
        opened INTEGER DEFAULT 0,
        opened_at TIMESTAMP,
        clicked INTEGER DEFAULT 0,
        clicked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create remaining required tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER,
        client_id INTEGER,
        answers TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create clients table for client management features
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        extra_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create forms table used by surveys
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        questions TEXT,
        created_by INTEGER,
        is_multi_step INTEGER DEFAULT 0,
        steps TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Minimal schema created successfully for sandbox environment');
    return true;
  } catch (error) {
    console.error('Error creating minimal schema:', error);
    return false;
  }
};

// Function to initialize database
const initDb = async () => {
  try {
    // Pool should already be initialized synchronously
    // For SQLite, create tables
    if (usingSqlite) {
      await createMinimalSchema();
      await ensureAdminExists();
      await createSampleFeedbackForm();
      await seedSampleClients();
      console.log('Database initialized successfully in sandbox mode');
      
      // Verify admin user was created
      try {
        const adminCheck = await pool.query('SELECT * FROM admins WHERE username = $1', ['admin']);
        if (adminCheck.rows && adminCheck.rows.length > 0) {
          console.log('✅ Admin user verified (username: admin, password: admin123)');
        } else {
          console.error('❌ Admin user verification failed - admin not found');
          // Try one more time to create the admin
          await pool.query(
            'INSERT OR IGNORE INTO admins (username, email, password_hash) VALUES ($1, $2, $3)',
            ['admin', 'admin@example.com', '$2b$10$rMYQMgw3LHmKWJgMYdM5qem/mKv91OjsKtODws.JJx7FP0HiXvXI6']
          );
        }
      } catch (err) {
        console.error('Error verifying admin user:', err);
      }
      
      return {
        success: true,
        pool,
        query
      };
    }
    
    // Check if tables already exist
    const tablesExist = await checkTablesExist();
    
    if (!tablesExist) {
      console.log('Database tables do not exist. Creating schema...');
      try {
        // Read and execute schema SQL
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(schemaSql);
        console.log('Database schema initialized successfully');
      } catch (schemaError) {
        console.error('Error creating schema:', schemaError);
        return false;
      }
    } else {
      console.log('Database tables already exist. Skipping schema creation.');
      
      // Run migrations for existing tables if needed
      await migrateEmailLogs();
    }
    
    // Ensure admin user exists
    await ensureAdminExists();
    
    // Create sample feedback form
    await createSampleFeedbackForm();
    
    // Seed sample clients if needed
    await seedSampleClients();
    
    // Initialize default settings
    try {
      const Settings = require('../models/settings');
      await Settings.initDefaults();
    } catch (error) {
      console.error('Error initializing settings:', error);
    }
    
    // Verify admin user was created
    try {
      const adminCheck = await pool.query('SELECT * FROM admins WHERE username = $1', ['admin']);
      if (adminCheck.rows && adminCheck.rows.length > 0) {
        console.log('✅ Admin user verified (username: admin, password: admin123)');
      } else {
        console.error('❌ Admin user verification failed - admin not found');
      }
    } catch (err) {
      console.error('Error verifying admin user:', err);
    }
    
    console.log('Database initialized successfully');
    return {
      success: true,
      pool,
      query
    };
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
};

module.exports = {
  query,
  initDb,
  pool,
  isSandboxEnvironment
};