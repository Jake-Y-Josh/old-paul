const { chromium } = require('playwright');

async function testAllPages() {
  console.log('Starting Playwright tests for all application pages...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Track results
  const results = [];
  
  // Helper function to test a page
  async function testPage(url, description) {
    console.log(`Testing: ${description}`);
    console.log(`URL: ${url}`);
    
    try {
      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Check response status
      const status = response.status();
      console.log(`Status: ${status}`);
      
      // Check for common error indicators
      const pageContent = await page.content();
      const hasError = pageContent.includes('Error') || 
                      pageContent.includes('error') ||
                      pageContent.includes('ECONNREFUSED') ||
                      pageContent.includes('Cannot') ||
                      pageContent.includes('TypeError');
      
      // Check page title
      const title = await page.title();
      console.log(`Title: ${title}`);
      
      // Take screenshot for debugging
      await page.screenshot({ 
        path: `screenshots/${description.replace(/[^a-z0-9]/gi, '_')}.png`,
        fullPage: true 
      });
      
      // Check for specific elements based on page type
      let pageSpecificChecks = {};
      
      if (url.includes('/admin/login')) {
        // Check for login form
        const hasLoginForm = await page.locator('form').count() > 0;
        const hasUsernameField = await page.locator('input[name="username"]').count() > 0;
        const hasPasswordField = await page.locator('input[type="password"]').count() > 0;
        pageSpecificChecks = {
          hasLoginForm,
          hasUsernameField,
          hasPasswordField
        };
      }
      
      if (url.includes('/admin/dashboard')) {
        // Check for dashboard elements
        const hasNavbar = await page.locator('nav').count() > 0;
        const hasSidebar = await page.locator('.sidebar').count() > 0;
        pageSpecificChecks = {
          hasNavbar,
          hasSidebar
        };
      }
      
      results.push({
        url,
        description,
        status,
        title,
        hasError,
        success: status === 200 && !hasError,
        pageSpecificChecks,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Result: ${status === 200 && !hasError ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log('---\n');
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.push({
        url,
        description,
        status: 'ERROR',
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      });
      console.log('---\n');
    }
  }
  
  // Create screenshots directory
  const fs = require('fs');
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }
  
  const baseUrl = 'http://localhost:3005';
  
  // Test all pages
  console.log('=== TESTING PUBLIC PAGES ===\n');
  
  await testPage(`${baseUrl}/`, 'Homepage');
  await testPage(`${baseUrl}/admin/login`, 'Admin Login Page');
  await testPage(`${baseUrl}/feedback/submit/1`, 'Feedback Form (ID: 1)');
  await testPage(`${baseUrl}/feedback/submit/999`, 'Feedback Form (Invalid ID)');
  
  console.log('\n=== TESTING ADMIN PAGES (WITHOUT AUTH) ===\n');
  
  // These should redirect to login
  await testPage(`${baseUrl}/admin/dashboard`, 'Admin Dashboard (No Auth)');
  await testPage(`${baseUrl}/admin/forms`, 'Forms Management (No Auth)');
  await testPage(`${baseUrl}/admin/clients`, 'Clients Management (No Auth)');
  await testPage(`${baseUrl}/admin/submissions`, 'Submissions (No Auth)');
  await testPage(`${baseUrl}/admin/emails`, 'Email Management (No Auth)');
  await testPage(`${baseUrl}/admin/settings`, 'Settings (No Auth)');
  
  console.log('\n=== ATTEMPTING ADMIN LOGIN ===\n');
  
  // Try to login as admin
  await page.goto(`${baseUrl}/admin/login`);
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForLoadState('networkidle');
  
  const currentUrl = page.url();
  console.log(`After login, redirected to: ${currentUrl}`);
  
  if (currentUrl.includes('/admin/dashboard')) {
    console.log('✅ Login successful!\n');
    
    console.log('=== TESTING ADMIN PAGES (WITH AUTH) ===\n');
    
    // Test authenticated admin pages
    await testPage(`${baseUrl}/admin/dashboard`, 'Admin Dashboard (Authenticated)');
    await testPage(`${baseUrl}/admin/forms`, 'Forms Management (Authenticated)');
    await testPage(`${baseUrl}/admin/forms/new`, 'Create New Form');
    await testPage(`${baseUrl}/admin/forms/1/edit`, 'Edit Form (ID: 1)');
    await testPage(`${baseUrl}/admin/clients`, 'Clients Management (Authenticated)');
    await testPage(`${baseUrl}/admin/clients/new`, 'Add New Client');
    await testPage(`${baseUrl}/admin/clients/1/edit`, 'Edit Client (ID: 1)');
    await testPage(`${baseUrl}/admin/submissions`, 'Submissions (Authenticated)');
    await testPage(`${baseUrl}/admin/emails`, 'Email Management (Authenticated)');
    await testPage(`${baseUrl}/admin/settings`, 'Settings (Authenticated)');
    await testPage(`${baseUrl}/admin/profile`, 'Admin Profile');
    
    // Test API endpoints
    console.log('\n=== TESTING API ENDPOINTS ===\n');
    
    const apiEndpoints = [
      { url: `${baseUrl}/api/forms`, method: 'GET', description: 'Get all forms' },
      { url: `${baseUrl}/api/clients`, method: 'GET', description: 'Get all clients' },
      { url: `${baseUrl}/api/submissions`, method: 'GET', description: 'Get all submissions' },
      { url: `${baseUrl}/api/emails/logs`, method: 'GET', description: 'Get email logs' }
    ];
    
    for (const endpoint of apiEndpoints) {
      console.log(`Testing API: ${endpoint.description}`);
      console.log(`${endpoint.method} ${endpoint.url}`);
      
      try {
        const apiResponse = await page.evaluate(async ({ url, method }) => {
          const response = await fetch(url, { 
            method,
            credentials: 'include'
          });
          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: await response.text()
          };
        }, endpoint);
        
        console.log(`Status: ${apiResponse.status} ${apiResponse.statusText}`);
        console.log(`Content-Type: ${apiResponse.headers['content-type']}`);
        
        results.push({
          url: endpoint.url,
          description: endpoint.description,
          status: apiResponse.status,
          success: apiResponse.status === 200,
          type: 'API',
          timestamp: new Date().toISOString()
        });
        
        console.log(`Result: ${apiResponse.status === 200 ? '✅ SUCCESS' : '❌ FAILED'}`);
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        results.push({
          url: endpoint.url,
          description: endpoint.description,
          status: 'ERROR',
          error: error.message,
          success: false,
          type: 'API',
          timestamp: new Date().toISOString()
        });
      }
      console.log('---\n');
    }
  } else {
    console.log('❌ Login failed!\n');
  }
  
  // Generate summary report
  console.log('\n=== TEST SUMMARY ===\n');
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
  
  console.log('\n=== FAILED TESTS ===\n');
  
  const failures = results.filter(r => !r.success);
  if (failures.length === 0) {
    console.log('No failures! 🎉');
  } else {
    failures.forEach(failure => {
      console.log(`❌ ${failure.description}`);
      console.log(`   URL: ${failure.url}`);
      console.log(`   Status: ${failure.status}`);
      if (failure.error) {
        console.log(`   Error: ${failure.error}`);
      }
      console.log('');
    });
  }
  
  // Save detailed results to file
  fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
  console.log('\nDetailed results saved to test-results.json');
  console.log('Screenshots saved to screenshots/ directory');
  
  await browser.close();
}

// Run the tests
testAllPages().catch(console.error);