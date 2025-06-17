// Load environment variables
require('dotenv').config();

// CRITICAL: Force SSL certificate validation to be disabled for all environments
// This is required due to self-signed certificate issues in the certificate chain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('Starting application with NODE_TLS_REJECT_UNAUTHORIZED=0');
console.log('Environment:', process.env.NODE_ENV);
console.log('Database host:', process.env.DB_HOST ? 'Set' : 'Not set');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

// Import and configure the app
const app = require('./src/app');

// Export for Vercel serverless functions
module.exports = app; 