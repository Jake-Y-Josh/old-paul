/**
 * Migration script to create Supabase Auth users for existing admins
 * Run this script once to migrate existing admin users to Supabase Auth
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL || 'https://hsacflpklcasjgffgzwd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required for admin operations');
  console.error('Please set it in your .env file');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createDefaultAdmin() {
  console.log('=== SUPABASE AUTH ADMIN CREATION ===\n');
  
  try {
    // Create a default admin user
    const defaultEmail = 'admin@example.com';
    const defaultPassword = 'Admin123!'; // Strong password that meets requirements
    const defaultUsername = 'admin';
    
    console.log('Creating default admin user...');
    console.log(`Email: ${defaultEmail}`);
    console.log(`Username: ${defaultUsername}`);
    console.log(`Password: ${defaultPassword}`);
    console.log('');
    
    // Check if user already exists
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users.find(u => u.email === defaultEmail);
    
    if (existingUser) {
      console.log('✓ Default admin user already exists in Supabase Auth');
      console.log(`  User ID: ${existingUser.id}`);
      console.log(`  Email: ${existingUser.email}`);
      
      // Update the password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password: defaultPassword }
      );
      
      if (updateError) {
        console.error('✗ Error updating password:', updateError);
      } else {
        console.log('✓ Password updated to default');
      }
    } else {
      // Create new user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: defaultEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          username: defaultUsername,
          created_by: 'migration_script'
        }
      });
      
      if (error) {
        console.error('✗ Error creating user:', error);
        return;
      }
      
      console.log('✓ Default admin user created successfully!');
      console.log(`  User ID: ${data.user.id}`);
    }
    
    // Also ensure the admin exists in the database
    const { supabase } = require('./src/database/supabase');
    
    // Check if admin exists in the admins table
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select()
      .eq('email', defaultEmail)
      .single();
    
    if (!existingAdmin) {
      // Create admin in database
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      const { error: insertError } = await supabase
        .from('admins')
        .insert([{
          username: defaultUsername,
          email: defaultEmail,
          password_hash: passwordHash,
          is_active: true,
          created_at: new Date().toISOString()
        }]);
      
      if (insertError) {
        console.error('✗ Error creating admin in database:', insertError);
      } else {
        console.log('✓ Admin created in database');
      }
    } else {
      console.log('✓ Admin already exists in database');
    }
    
    console.log('\n=== MIGRATION COMPLETED ===');
    console.log('\nYou can now log in with:');
    console.log(`Email: ${defaultEmail}`);
    console.log(`Password: ${defaultPassword}`);
    console.log('\nIMPORTANT: Change this password after first login!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the migration
createDefaultAdmin();