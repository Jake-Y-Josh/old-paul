/**
 * Supabase Client Configuration
 * 
 * This file sets up the Supabase client for direct interaction with Supabase API
 * rather than using raw PostgreSQL connections.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - read from environment or use hardcoded fallback
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hsacflpklcasjgffgzwd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWNmbHBrbGNhc2pnZmZnendkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2ODEyMjgsImV4cCI6MjA1NzI1NzIyOH0.jyZb70tFxskfVI_VOs_DJU6NRXe6jVZE_qCT1t09ExU';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase client initialized');

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

// Function to check if any admin exists (removed hardcoded admin creation)
const checkAdminExists = async () => {
  try {
    const { data: admins, error } = await supabase
      .from('admins')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Error checking for admins:', error);
      return false;
    }
    
    const hasAdmins = admins && admins.length > 0;
    if (!hasAdmins) {
      console.log('>>> WARNING: No admin users exist in the database <<<');
      console.log('>>> Please run: node migrate-to-supabase-auth.js to create admin users <<<');
    } else {
      console.log('>>> Admin users found in database <<<');
    }
    
    return hasAdmins;
  } catch (error) {
    console.error('Error checking admin existence:', error);
    return false;
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
    console.log('>>> SUPABASE AUTH IS THE ONLY AUTHENTICATION METHOD <<<');
    console.log('>>> Hardcoded admin/admin123 has been REMOVED <<<');
    
    // Check if any admin exists (no longer creates default admin)
    await checkAdminExists();
    
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