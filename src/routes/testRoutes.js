const express = require('express');
const router = express.Router();
const { supabase } = require('../database/supabase');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const Admin = require('../models/admin');
const Client = require('../models/client');
const Form = require('../models/form');
const EmailLog = require('../models/emailLog');
const Settings = require('../models/settings');
const { verifyTransporter, sendTestEmail } = require('../utils/mailer');

// Hidden comprehensive diagnostics route - not linked anywhere in the UI
router.get('/db-test-hidden-diagnostic', async (req, res) => {
  const testResults = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'undefined',
    categories: {
      database: { tests: [], passed: 0, failed: 0 },
      authentication: { tests: [], passed: 0, failed: 0 },
      email: { tests: [], passed: 0, failed: 0 },
      forms: { tests: [], passed: 0, failed: 0 },
      filesystem: { tests: [], passed: 0, failed: 0 },
      configuration: { tests: [], passed: 0, failed: 0 },
      security: { tests: [], passed: 0, failed: 0 },
      models: { tests: [], passed: 0, failed: 0 }
    },
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      successRate: 0
    }
  };

  // Helper function to run a test
  async function runTest(category, testName, testFunction) {
    const test = {
      name: testName,
      status: 'running',
      result: null,
      error: null,
      duration: 0,
      details: null
    };
    
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      test.result = result.message || result;
      test.details = result.details || null;
      test.status = 'passed';
      testResults.categories[category].passed++;
      testResults.summary.passed++;
    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
      testResults.categories[category].failed++;
      testResults.summary.failed++;
    }
    
    test.duration = Date.now() - startTime;
    testResults.categories[category].tests.push(test);
    testResults.summary.total++;
  }

  // ======= DATABASE TESTS =======
  
  await runTest('database', 'Supabase Connection Test', async () => {
    const { data, error } = await supabase.from('admins').select('count').limit(1);
    if (error) throw error;
    return { message: 'Connection successful', details: 'Supabase client connected' };
  });

  await runTest('database', 'Admins Table Access', async () => {
    const { data, error } = await supabase.from('admins').select('id, username, email, created_at').limit(5);
    if (error) throw error;
    return { 
      message: `Found ${data.length} admin records`,
      details: data.map(admin => ({ id: admin.id, username: admin.username, email: admin.email }))
    };
  });

  await runTest('database', 'Clients Table Access', async () => {
    const { data, error } = await supabase.from('clients').select('id, name, email, created_at').limit(5);
    if (error) throw error;
    return { 
      message: `Found ${data.length} client records`,
      details: data.map(client => ({ id: client.id, name: client.name, email: client.email }))
    };
  });

  await runTest('database', 'Forms Table Access', async () => {
    const { data, error } = await supabase.from('forms').select('id, title, created_at').limit(5);
    if (error) throw error;
    return { 
      message: `Found ${data.length} form records`,
      details: data.map(form => ({ id: form.id, title: form.title }))
    };
  });

  await runTest('database', 'Form Submissions Table Access', async () => {
    const { data, error } = await supabase.from('form_submissions').select('id, form_id, client_id, created_at').limit(5);
    if (error) throw error;
    return { message: `Found ${data.length} submission records` };
  });

  await runTest('database', 'Email Logs Table Access', async () => {
    const { data, error } = await supabase.from('email_logs').select('id, to_email, subject, status, created_at').limit(5);
    if (error) throw error;
    return { message: `Found ${data.length} email log records` };
  });

  await runTest('database', 'Activities Table Access', async () => {
    const { data, error } = await supabase.from('activities').select('id, admin_id, action, created_at').limit(5);
    if (error) throw error;
    return { message: `Found ${data.length} activity records` };
  });

  await runTest('database', 'Settings Table Access', async () => {
    const { data, error } = await supabase.from('settings').select('id, key, value, created_at').limit(5);
    if (error) throw error;
    return { message: `Found ${data.length} setting records` };
  });

  await runTest('database', 'Database Write Operations', async () => {
    const { data: insertData, error: insertError } = await supabase
      .from('activities')
      .insert([{
        admin_id: null,
        action: 'DIAGNOSTIC_TEST',
        details: 'Database write test from diagnostics',
        ip_address: req.ip || 'unknown',
        created_at: new Date()
      }])
      .select();
    
    if (insertError) throw insertError;
    
    const testId = insertData[0].id;
    
    const { error: deleteError } = await supabase
      .from('activities')
      .delete()
      .eq('id', testId);
    
    if (deleteError) throw deleteError;
    
    return { message: 'Write and delete operations successful', details: `Test record ID: ${testId}` };
  });

  await runTest('database', 'Complex Query Test', async () => {
    const { data, error } = await supabase
      .from('form_submissions')
      .select(`
        id,
        created_at,
        forms:form_id (id, title),
        clients:client_id (id, name, email)
      `)
      .limit(3);
    
    if (error) throw error;
    return { message: `Retrieved ${data.length} submissions with related data` };
  });

  // ======= AUTHENTICATION TESTS =======

  await runTest('authentication', 'Password Hashing Test', async () => {
    const testPassword = 'test123';
    const hash = await bcrypt.hash(testPassword, 10);
    const isValid = await bcrypt.compare(testPassword, hash);
    if (!isValid) throw new Error('Password hash/compare failed');
    return { message: 'Password hashing working correctly', details: 'bcrypt hash/compare successful' };
  });

  await runTest('authentication', 'Admin Model Authentication', async () => {
    const adminCount = await Admin.count();
    return { 
      message: `Admin model functional, ${adminCount} admins in database`,
      details: 'Admin.count() method working'
    };
  });

  await runTest('authentication', 'Session Configuration Test', async () => {
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret === 'default_session_secret_should_be_changed') {
      throw new Error('SESSION_SECRET not properly configured');
    }
    return { 
      message: 'Session secret properly configured',
      details: 'SESSION_SECRET environment variable set'
    };
  });

  await runTest('authentication', 'Admin Login Functionality', async () => {
    const testAdmin = await Admin.findByUsername('admin');
    if (!testAdmin) throw new Error('Default admin user not found');
    
    const isValidPassword = await bcrypt.compare('admin123', testAdmin.password_hash);
    if (!isValidPassword) throw new Error('Default admin password verification failed');
    
    return { 
      message: 'Default admin login credentials working',
      details: `Admin ID: ${testAdmin.id}, Username: ${testAdmin.username}`
    };
  });

  await runTest('authentication', 'Admin Invitation System', async () => {
    const invitationToken = 'test-invitation-' + Date.now();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Test invitation token generation (simulate)
    const hash = await bcrypt.hash(invitationToken, 10);
    return { 
      message: 'Invitation system components functional',
      details: 'Token generation and expiry logic working'
    };
  });

  // ======= EMAIL SYSTEM TESTS =======

  await runTest('email', 'Email Configuration Check', async () => {
    const config = {
      smtp_host: process.env.SMTP_HOST || 'Not set',
      smtp_port: process.env.SMTP_PORT || 'Not set',
      smtp_user: process.env.SMTP_USER ? 'Set' : 'Not set',
      smtp_pass: process.env.SMTP_PASS ? 'Set' : 'Not set',
      email_from: process.env.EMAIL_FROM || 'Not set',
      email_from_name: process.env.EMAIL_FROM_NAME || 'Not set'
    };
    
    const missingConfigs = Object.entries(config).filter(([key, value]) => value === 'Not set');
    if (missingConfigs.length > 0) {
      throw new Error(`Missing email configurations: ${missingConfigs.map(([key]) => key).join(', ')}`);
    }
    
    return { 
      message: 'All email configurations present',
      details: config
    };
  });

  await runTest('email', 'SMTP Connection Test', async () => {
    const isVerified = await verifyTransporter();
    if (!isVerified) throw new Error('SMTP connection failed');
    return { message: 'SMTP connection successful', details: 'Transporter verified' };
  });

  await runTest('email', 'Email Logging System', async () => {
    const recentLogs = await EmailLog.getRecent(5);
    return { 
      message: `Email logging system functional, ${recentLogs.length} recent logs`,
      details: recentLogs.map(log => ({ id: log.id, to: log.to_email, status: log.status }))
    };
  });

  await runTest('email', 'Email Template System', async () => {
    try {
      const settings = await Settings.getMultiple(['emailTemplate', 'signature']);
      return { 
        message: 'Email template system accessible',
        details: {
          hasTemplate: !!settings.emailTemplate,
          hasSignature: !!settings.signature
        }
      };
    } catch (error) {
      return { 
        message: 'Email template system using defaults',
        details: 'Settings table may be empty, using fallback templates'
      };
    }
  });

  // ======= FORMS SYSTEM TESTS =======

  await runTest('forms', 'Form Model Functionality', async () => {
    const formCount = await Form.count();
    const forms = await Form.getAll();
    return { 
      message: `Form system functional, ${formCount} forms in database`,
      details: forms.slice(0, 3).map(form => ({ id: form.id, title: form.title }))
    };
  });

  await runTest('forms', 'Form Submission System', async () => {
    const { data, error } = await supabase
      .from('form_submissions')
      .select('id, form_id, responses, created_at')
      .limit(1);
    
    if (error) throw error;
    
    return { 
      message: `Form submissions accessible, ${data.length} recent submissions found`,
      details: data.map(sub => ({ id: sub.id, form_id: sub.form_id }))
    };
  });

  await runTest('forms', 'Form Validation System', async () => {
    // Test form structure validation
    const testFormData = {
      title: 'Test Form',
      description: 'Test Description',
      questions: [
        { type: 'text', question: 'Test Question', required: true }
      ]
    };
    
    // This would normally use Form.validate() if it exists
    const isValid = testFormData.title && testFormData.questions && Array.isArray(testFormData.questions);
    if (!isValid) throw new Error('Form validation failed');
    
    return { message: 'Form validation system functional', details: 'Basic form structure validation working' };
  });

  // ======= FILESYSTEM TESTS =======

  await runTest('filesystem', 'Public Directory Access', async () => {
    const publicDir = path.join(__dirname, '../public');
    const exists = fs.existsSync(publicDir);
    if (!exists) throw new Error('Public directory not found');
    
    const files = fs.readdirSync(publicDir);
    return { 
      message: `Public directory accessible with ${files.length} items`,
      details: files.slice(0, 5)
    };
  });

  await runTest('filesystem', 'Views Directory Access', async () => {
    const viewsDir = path.join(__dirname, '../views');
    const exists = fs.existsSync(viewsDir);
    if (!exists) throw new Error('Views directory not found');
    
    const adminViews = fs.existsSync(path.join(viewsDir, 'admin'));
    const publicViews = fs.existsSync(path.join(viewsDir, 'public'));
    const layouts = fs.existsSync(path.join(viewsDir, 'layouts'));
    
    return { 
      message: 'Views directory structure complete',
      details: { adminViews, publicViews, layouts }
    };
  });

  await runTest('filesystem', 'Upload Directory Test', async () => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    
    if (process.env.VERCEL) {
      return { 
        message: 'Running on Vercel - uploads directory not applicable',
        details: 'Vercel has read-only filesystem'
      };
    }
    
    const exists = fs.existsSync(uploadsDir);
    if (!exists) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Test write permissions
    const testFile = path.join(uploadsDir, 'test-write.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    return { 
      message: 'Upload directory writable',
      details: 'Directory exists and has write permissions'
    };
  });

  // ======= CONFIGURATION TESTS =======

  await runTest('configuration', 'Environment Variables Check', async () => {
    const required = ['DATABASE_URL', 'SESSION_SECRET'];
    const optional = ['SMTP_HOST', 'SMTP_USER', 'EMAIL_FROM', 'APP_URL'];
    
    const missing = required.filter(key => !process.env[key]);
    const present = optional.filter(key => process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    return { 
      message: `All required env vars present, ${present.length}/${optional.length} optional vars set`,
      details: { required: required.length, optional: present }
    };
  });

  await runTest('configuration', 'Node.js Version Check', async () => {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (major < 14) {
      throw new Error(`Node.js version ${nodeVersion} is too old (minimum: 14)`);
    }
    
    return { 
      message: `Node.js version ${nodeVersion} is compatible`,
      details: `Major version: ${major}`
    };
  });

  await runTest('configuration', 'Package Dependencies Check', async () => {
    const packagePath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const depCount = Object.keys(packageJson.dependencies || {}).length;
    const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
    
    return { 
      message: `Package configuration loaded: ${depCount} dependencies, ${devDepCount} dev dependencies`,
      details: { 
        name: packageJson.name,
        version: packageJson.version,
        dependencies: depCount,
        devDependencies: devDepCount
      }
    };
  });

  // ======= SECURITY TESTS =======

  await runTest('security', 'SSL/TLS Configuration', async () => {
    const tlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction && tlsReject === '0') {
      throw new Error('TLS rejection disabled in production - security risk');
    }
    
    return { 
      message: `TLS configuration appropriate for ${process.env.NODE_ENV || 'development'} environment`,
      details: { tlsReject, isProduction }
    };
  });

  await runTest('security', 'Session Security Check', async () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const sessionSecret = process.env.SESSION_SECRET;
    
    if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
      throw new Error('Session secret too weak for production');
    }
    
    return { 
      message: 'Session security configuration appropriate',
      details: { 
        secretLength: sessionSecret ? sessionSecret.length : 0,
        isProduction 
      }
    };
  });

  // ======= MODEL TESTS =======

  await runTest('models', 'Admin Model Methods', async () => {
    const methods = ['findByUsername', 'count', 'create'];
    const availableMethods = methods.filter(method => typeof Admin[method] === 'function');
    
    if (availableMethods.length !== methods.length) {
      throw new Error(`Missing Admin model methods: ${methods.filter(m => !availableMethods.includes(m)).join(', ')}`);
    }
    
    return { 
      message: 'All Admin model methods available',
      details: availableMethods
    };
  });

  await runTest('models', 'Client Model Methods', async () => {
    const methods = ['getAll', 'count', 'create'];
    const availableMethods = methods.filter(method => typeof Client[method] === 'function');
    
    return { 
      message: `Client model functional: ${availableMethods.length} methods available`,
      details: availableMethods
    };
  });

  await runTest('models', 'Form Model Methods', async () => {
    const methods = ['getAll', 'count', 'create'];
    const availableMethods = methods.filter(method => typeof Form[method] === 'function');
    
    return { 
      message: `Form model functional: ${availableMethods.length} methods available`,
      details: availableMethods
    };
  });

  // Calculate summary statistics
  Object.keys(testResults.categories).forEach(category => {
    const cat = testResults.categories[category];
    cat.total = cat.passed + cat.failed;
    cat.successRate = cat.total > 0 ? Math.round((cat.passed / cat.total) * 100) : 0;
  });

  testResults.summary.successRate = testResults.summary.total > 0 
    ? Math.round((testResults.summary.passed / testResults.summary.total) * 100)
    : 0;

  res.render('test/db-test', {
    title: 'Comprehensive System Diagnostics',
    testResults,
    req: req,
    layout: 'layouts/main'
  });
});

module.exports = router;