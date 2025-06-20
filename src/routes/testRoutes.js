const express = require('express');
const router = express.Router();
const { supabase } = require('../database/supabase');

// Hidden database test route - not linked anywhere in the UI
router.get('/db-test-hidden-diagnostic', async (req, res) => {
  const testResults = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'undefined',
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  // Helper function to run a test
  async function runTest(testName, testFunction) {
    const test = {
      name: testName,
      status: 'running',
      result: null,
      error: null,
      duration: 0
    };
    
    const startTime = Date.now();
    
    try {
      test.result = await testFunction();
      test.status = 'passed';
      testResults.summary.passed++;
    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
      testResults.summary.failed++;
    }
    
    test.duration = Date.now() - startTime;
    testResults.tests.push(test);
    testResults.summary.total++;
  }

  // Test 1: Basic Supabase connection
  await runTest('Supabase Connection Test', async () => {
    const { data, error } = await supabase.from('admins').select('count').limit(1);
    if (error) throw error;
    return 'Connection successful';
  });

  // Test 2: Admins table access
  await runTest('Admins Table Access', async () => {
    const { data, error } = await supabase.from('admins').select('id, username, email, created_at').limit(5);
    if (error) throw error;
    return `Found ${data.length} admin records`;
  });

  // Test 3: Clients table access
  await runTest('Clients Table Access', async () => {
    const { data, error } = await supabase.from('clients').select('id, name, email, created_at').limit(5);
    if (error) throw error;
    return `Found ${data.length} client records`;
  });

  // Test 4: Forms table access
  await runTest('Forms Table Access', async () => {
    const { data, error } = await supabase.from('forms').select('id, title, created_at').limit(5);
    if (error) throw error;
    return `Found ${data.length} form records`;
  });

  // Test 5: Form submissions table access
  await runTest('Form Submissions Table Access', async () => {
    const { data, error } = await supabase.from('form_submissions').select('id, form_id, client_id, created_at').limit(5);
    if (error) throw error;
    return `Found ${data.length} submission records`;
  });

  // Test 6: Email logs table access
  await runTest('Email Logs Table Access', async () => {
    const { data, error } = await supabase.from('email_logs').select('id, to_email, subject, status, created_at').limit(5);
    if (error) throw error;
    return `Found ${data.length} email log records`;
  });

  // Test 7: Activities table access
  await runTest('Activities Table Access', async () => {
    const { data, error } = await supabase.from('activities').select('id, admin_id, action, created_at').limit(5);
    if (error) throw error;
    return `Found ${data.length} activity records`;
  });

  // Test 8: Settings table access
  await runTest('Settings Table Access', async () => {
    const { data, error } = await supabase.from('settings').select('id, key, value, created_at').limit(5);
    if (error) throw error;
    return `Found ${data.length} setting records`;
  });

  // Test 9: Write operation test (create and delete a test record)
  await runTest('Database Write Operations', async () => {
    // Create a test activity record
    const { data: insertData, error: insertError } = await supabase
      .from('activities')
      .insert([{
        admin_id: null,
        action: 'DB_TEST',
        details: 'Database connectivity test',
        ip_address: req.ip || 'unknown',
        created_at: new Date()
      }])
      .select();
    
    if (insertError) throw insertError;
    
    const testId = insertData[0].id;
    
    // Delete the test record
    const { error: deleteError } = await supabase
      .from('activities')
      .delete()
      .eq('id', testId);
    
    if (deleteError) throw deleteError;
    
    return 'Write and delete operations successful';
  });

  // Test 10: Complex query test (join-like operation)
  await runTest('Complex Query Test', async () => {
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
    return `Retrieved ${data.length} submissions with related form and client data`;
  });

  // Calculate success rate
  const successRate = testResults.summary.total > 0 
    ? Math.round((testResults.summary.passed / testResults.summary.total) * 100)
    : 0;

  testResults.summary.successRate = successRate;

  res.render('test/db-test', {
    title: 'Database Connectivity Test',
    testResults,
    req: req,
    layout: 'layouts/main'
  });
});

module.exports = router;