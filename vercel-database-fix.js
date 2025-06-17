/**
 * VERCEL DATABASE CONNECTION FIXER
 * 
 * This script specifically addresses database connection issues in Vercel environment
 * by testing various connection methods and generating a .env.production file
 * with the correct settings for Vercel.
 */

const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

// Force disable TLS certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('VERCEL DATABASE CONNECTION FIXER');
console.log('===============================');

// Show current environment
console.log('\nCurrent Environment:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set [REDACTED]' : 'Not Set');
console.log('Node Environment:', process.env.NODE_ENV || 'Not Set');
console.log('TLS Certificate Validation:', process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? 'Disabled' : 'Enabled');

// Check various connection methods
async function testConnections() {
  let workingMethod = null;
  let workingConfig = null;
  
  if (process.env.DATABASE_URL) {
    // Test with modified DATABASE_URL
    console.log('\nTesting connection with modified DATABASE_URL...');
    
    // Method 1: Modify DATABASE_URL with sslmode=no-verify
    try {
      let modifiedUrl = process.env.DATABASE_URL;
      if (!modifiedUrl.includes('sslmode=')) {
        modifiedUrl += modifiedUrl.includes('?') ? '&sslmode=no-verify' : '?sslmode=no-verify';
      } else if (!modifiedUrl.includes('sslmode=no-verify')) {
        modifiedUrl = modifiedUrl.replace(/sslmode=[^&]+/, 'sslmode=no-verify');
      }
      
      const pool = new Pool({
        connectionString: modifiedUrl,
        ssl: { rejectUnauthorized: false }
      });
      
      const result = await pool.query('SELECT NOW() as time');
      console.log('✅ Success! Connection worked with sslmode=no-verify');
      console.log('Database time:', result.rows[0].time);
      
      workingMethod = 'MODIFIED_URL';
      workingConfig = {
        DATABASE_URL: modifiedUrl,
        NODE_TLS_REJECT_UNAUTHORIZED: '0'
      };
      
      await pool.end();
    } catch (error) {
      console.log('❌ Connection failed with sslmode=no-verify:', error.message);
    }
    
    // Method 2: Original URL with SSL disabled
    if (!workingMethod) {
      try {
        console.log('\nTesting connection with original DATABASE_URL and SSL disabled...');
        
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });
        
        const result = await pool.query('SELECT NOW() as time');
        console.log('✅ Success! Connection worked with SSL disabled');
        console.log('Database time:', result.rows[0].time);
        
        workingMethod = 'ORIGINAL_URL_SSL_DISABLED';
        workingConfig = {
          DATABASE_URL: process.env.DATABASE_URL,
          NODE_TLS_REJECT_UNAUTHORIZED: '0'
        };
        
        await pool.end();
      } catch (error) {
        console.log('❌ Connection failed with SSL disabled:', error.message);
      }
    }
    
    // Method 3: No SSL
    if (!workingMethod) {
      try {
        console.log('\nTesting connection with SSL completely disabled...');
        
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: false
        });
        
        const result = await pool.query('SELECT NOW() as time');
        console.log('✅ Success! Connection worked with SSL completely disabled');
        console.log('Database time:', result.rows[0].time);
        
        workingMethod = 'NO_SSL';
        workingConfig = {
          DATABASE_URL: process.env.DATABASE_URL,
          PG_SSL: 'false'
        };
        
        await pool.end();
      } catch (error) {
        console.log('❌ Connection failed with SSL completely disabled:', error.message);
      }
    }
  }
  
  // Individual connection parameters
  if (!workingMethod && process.env.DB_HOST) {
    try {
      console.log('\nTesting connection with individual parameters...');
      
      const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
      });
      
      const result = await pool.query('SELECT NOW() as time');
      console.log('✅ Success! Connection worked with individual parameters');
      console.log('Database time:', result.rows[0].time);
      
      workingMethod = 'INDIVIDUAL_PARAMS';
      workingConfig = {
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT || 5432,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_NAME: process.env.DB_NAME,
        NODE_TLS_REJECT_UNAUTHORIZED: '0'
      };
      
      await pool.end();
    } catch (error) {
      console.log('❌ Connection failed with individual parameters:', error.message);
    }
  }
  
  return { workingMethod, workingConfig };
}

// Generate Vercel-specific .env file
function generateVercelEnv(config) {
  if (!config) return false;
  
  let envContent = '# Vercel-specific environment variables generated by vercel-database-fix.js\n';
  
  // Add all environment variables to the file
  for (const [key, value] of Object.entries(config)) {
    envContent += `${key}=${value}\n`;
  }
  
  // Add critical Vercel settings
  envContent += 'NODE_ENV=production\n';
  envContent += 'NODE_TLS_REJECT_UNAUTHORIZED=0\n';
  
  // Add session secret if it exists
  if (process.env.SESSION_SECRET) {
    envContent += `SESSION_SECRET=${process.env.SESSION_SECRET}\n`;
  } else {
    // Generate random session secret
    const crypto = require('crypto');
    const randomSecret = crypto.randomBytes(32).toString('hex');
    envContent += `SESSION_SECRET=${randomSecret}\n`;
  }
  
  // Add other environment variables from .env if they exist
  const additionalVars = [
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE',
    'EMAIL_FROM', 'EMAIL_FROM_NAME', 'EMAIL_REPLY_TO'
  ];
  
  for (const varName of additionalVars) {
    if (process.env[varName]) {
      envContent += `${varName}=${process.env[varName]}\n`;
    }
  }
  
  // Write to .env.vercel file
  fs.writeFileSync('.env.vercel', envContent);
  console.log('\nCreated .env.vercel file with working database configuration.');
  
  return true;
}

// Generate vercel.json
function generateVercelJson(config) {
  if (!config) return false;
  
  const vercelConfig = {
    version: 2,
    builds: [
      {
        src: "index.js",
        use: "@vercel/node"
      }
    ],
    routes: [
      {
        src: "/(.*)",
        dest: "index.js"
      }
    ],
    env: {
      NODE_ENV: "production",
      NODE_TLS_REJECT_UNAUTHORIZED: "0"
    }
  };
  
  // Add database config to vercel.json
  for (const [key, value] of Object.entries(config)) {
    vercelConfig.env[key] = value;
  }
  
  // Add session secret
  if (process.env.SESSION_SECRET) {
    vercelConfig.env.SESSION_SECRET = process.env.SESSION_SECRET;
  }
  
  // Write to vercel.json.fixed file
  fs.writeFileSync('vercel.json.fixed', JSON.stringify(vercelConfig, null, 2));
  console.log('Created vercel.json.fixed with working database configuration.');
  
  return true;
}

// Print deployment instructions
function printInstructions(method) {
  console.log('\n=== DEPLOYMENT INSTRUCTIONS ===');
  console.log('To deploy to Vercel with the working database configuration:');
  console.log('');
  console.log('1. Replace your vercel.json with the generated vercel.json.fixed:');
  console.log('   mv vercel.json.fixed vercel.json');
  console.log('');
  console.log('2. Deploy to Vercel:');
  console.log('   vercel --prod');
  console.log('');
  console.log('3. Or use the Vercel web interface and upload these environment variables.');
  console.log('');
  console.log('4. For admin login, use:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('');
  
  if (method === 'MODIFIED_URL') {
    console.log('SUCCESS USING: Modified DATABASE_URL with sslmode=no-verify');
  } else if (method === 'ORIGINAL_URL_SSL_DISABLED') {
    console.log('SUCCESS USING: Original DATABASE_URL with SSL disabled');
  } else if (method === 'NO_SSL') {
    console.log('SUCCESS USING: No SSL configuration');
  } else if (method === 'INDIVIDUAL_PARAMS') {
    console.log('SUCCESS USING: Individual connection parameters');
  }
}

// Main function
async function main() {
  try {
    // Test connections
    const { workingMethod, workingConfig } = await testConnections();
    
    if (workingMethod) {
      // Generate Vercel environment file
      generateVercelEnv(workingConfig);
      
      // Generate Vercel JSON configuration
      generateVercelJson(workingConfig);
      
      // Print deployment instructions
      printInstructions(workingMethod);
    } else {
      console.log('\n❌ CRITICAL: No working database connection method found!');
      console.log('Please check your database credentials and ensure the database is accessible.');
      console.log('You may need to check your database firewall settings to allow connections from Vercel.');
    }
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the script
main();