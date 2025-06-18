/**
 * Supabase Client Configuration
 * 
 * This file sets up the Supabase client for direct interaction with Supabase API
 * rather than using raw PostgreSQL connections.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - read from environment or use hardcoded fallback
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hsacflpklcasjgffgzwd.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWNmbHBrbGNhc2pnZmZnendkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2ODEyMjgsImV4cCI6MjA1NzI1NzIyOH0.jyZb70tFxskfVI_VOs_DJU6NRXe6jVZE_qCT1t09ExU';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase client initialized');
console.log('  URL:', SUPABASE_URL);
console.log('  Key prefix:', SUPABASE_KEY ? SUPABASE_KEY.substring(0, 6) + '...' : 'Not set');

// Helper function to execute Supabase queries
const query = async (table, action, options = {}) => {
  try {
    let query = supabase.from(table);
    
    switch(action) {
      case 'select':
        query = query.select(options.columns || '*');
        break;
      case 'insert':
        query = query.insert(options.data);
        break;
      case 'update':
        query = query.update(options.data);
        break;
      case 'delete':
        query = query.delete();
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }
    
    // Apply filters
    if (options.filters) {
      for (const filter of options.filters) {
        query = query.filter(filter.column, filter.operator, filter.value);
      }
    }
    
    // Apply order
    if (options.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending });
    }
    
    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Format response to match pg query result format
    return {
      rows: data || [],
      rowCount: data ? data.length : 0
    };
  } catch (error) {
    console.error('Supabase query error:', error);
    throw error;
  }
};

// Function to ensure admin user exists
const ensureAdminExists = async () => {
  try {
    // Default password: admin123
    // This is the correct bcrypt hash for 'admin123'
    const passwordHash = '$2b$10$rMYQMgw3LHmKWJgMYdM5qem/mKv91OjsKtODws.JJx7FP0HiXvXI6';
    
    // Check if admin user exists
    const { data: existingAdmins } = await supabase
      .from('admins')
      .select()
      .eq('username', 'admin');
    
    if (!existingAdmins || existingAdmins.length === 0) {
      // Admin user doesn't exist, create it
      const { data: newAdmin, error } = await supabase
        .from('admins')
        .insert([
          {
            username: 'admin',
            email: 'admin@example.com',
            password_hash: passwordHash,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]);
      
      if (error) throw error;
      
      console.log('Default admin user created (username: admin, password: admin123)');
    } else {
      // Admin exists, but let's update the password hash to make sure it's correct
      const { error } = await supabase
        .from('admins')
        .update({ password_hash: passwordHash })
        .eq('username', 'admin');
      
      if (error) throw error;
      
      console.log('Admin user exists - password reset to default (admin123)');
    }
  } catch (error) {
    console.error('Error ensuring admin user exists:', error);
  }
};

// Initialize Supabase client
const initDb = async () => {
  try {
    // Test connection
    const { data, error } = await supabase.from('admins').select('count').limit(1);
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      return false;
    }
    
    console.log('Connected to Supabase successfully');
    
    // Ensure admin user exists
    await ensureAdminExists();
    
    console.log('Supabase database initialized successfully');
    return {
      success: true,
      supabase,
      query
    };
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    return false;
  }
};

module.exports = {
  supabase,
  query,
  initDb
};