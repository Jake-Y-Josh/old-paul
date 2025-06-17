const Client = require('../models/client');
const Form = require('../models/form');
const Email = require('../models/email');
const EmailLog = require('../models/emailLog');
const { sendFeedbackFormEmail } = require('../utils/mailer');

/**
 * Email Controller
 */

// Render email form selection page
const selectForm = async (req, res) => {
  try {
    const forms = await Form.getAll();
    const clients = await Client.getAll();
    
    res.render('admin/emails/select-form', {
      title: 'Send Feedback Form',
      forms,
      clients,
      success: req.query.success,
      error: req.query.error,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error loading email form selection:', error);
    res.render('error', { 
      message: 'Failed to load form selection',
      error,
      layout: false 
    });
  }
};

// Send emails to selected clients
const sendEmails = async (req, res) => {
  try {
    const { formId, clientIds } = req.body;
    
    // Validate required fields
    if (!formId || !clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Form ID and at least one client are required'
      });
    }
    
    // Get the form
    const form = await Form.getById(formId);
    
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found'
      });
    }
    
    // Get the base URL for the feedback form links
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    // Send emails to each client
    const results = [];
    
    for (const clientId of clientIds) {
      // Get the client
      const client = await Client.getById(clientId);
      
      if (!client) {
        results.push({
          clientId,
          success: false,
          message: 'Client not found'
        });
        continue;
      }
      
      // Generate a unique link for the client to access their feedback form
      const formLink = `${baseUrl}/feedback/${form.id}?client=${client.id}`;
      
      // Send the email
      const emailResult = await sendFeedbackFormEmail({
        to: client.email,
        clientName: client.name,
        formTitle: form.title,
        formLink: formLink
      });
      
      results.push({
        clientId,
        clientName: client.name,
        clientEmail: client.email,
        success: emailResult.success,
        message: emailResult.success 
          ? `Email sent successfully to ${client.email}`
          : `Failed to send email: ${emailResult.error}`
      });
    }
    
    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    res.status(200).json({
      success: true,
      message: `Sent ${successCount} emails successfully (${failureCount} failed)`,
      results
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send emails',
      error: error.message
    });
  }
};

// View email logs
const viewEmailLogs = async (req, res) => {
  try {
    console.log('Fetching email logs...');
    const logs = await EmailLog.getAll();
    console.log('Retrieved logs:', logs);
    
    // Extract messages from flash
    const success = req.flash('success')[0] || null;
    const error = req.flash('error')[0] || null;
    
    res.render('admin/emails/logs', {
      title: 'Email Logs',
      logs,
      success,
      error,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error viewing email logs:', error);
    req.flash('error', 'Failed to load email logs');
    res.redirect('/admin/dashboard');
  }
};

// Helper function to verify Resend webhook signatures
const verifyResendSignature = (signature, payload, secret) => {
  try {
    const crypto = require('crypto');
    
    // Extract timestamp and signature parts
    const [timestamp, hmacSig] = signature.split(',');
    const timestampValue = timestamp.split('=')[1];
    const hmacValue = hmacSig.split('=')[1];
    
    // Create the expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(timestampValue + '.' + payload);
    const expectedSignature = hmac.digest('hex');
    
    // Compare signatures
    console.log('Webhook verification:', {
      received: hmacValue,
      expected: expectedSignature,
      match: hmacValue === expectedSignature
    });
    
    return hmacValue === expectedSignature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};

// Handle Resend webhook events
const handleResendWebhook = async (req, res) => {
  try {
    const event = req.body;
    const payload = JSON.stringify(event);
    
    // Log webhook headers for debugging
    console.log('Webhook Headers:', {
      signature: req.headers['resend-signature'],
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    });
    
    // Log webhook payload
    console.log('Webhook Payload:', event);
    
    // Verify the request comes from Resend using signing secret
    const signature = req.headers['resend-signature'];
    if (!signature && process.env.NODE_ENV === 'production') {
      console.error('Missing Resend signature header');
      return res.status(401).json({ success: false, message: 'Missing signature header' });
    }
    
    // In production, verify the signature
    if (process.env.NODE_ENV === 'production' && process.env.RESEND_WEBHOOK_SECRET) {
      if (!verifyResendSignature(signature, payload, process.env.RESEND_WEBHOOK_SECRET)) {
        console.error('Invalid Resend signature');
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('Webhook secret not configured but running in production');
    }
    
    // Log different info based on environment
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Received Resend webhook event: ${event.type}`, event);
    } else {
      console.log(`[PROD] Received Resend webhook event: ${event.type}`, { id: event.data?.id, type: event.type });
    }
    
    // Verify event has required data
    if (!event || !event.type) {
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }
    
    let result = false;
    const messageId = event.data?.id;
    
    if (!messageId) {
      return res.status(400).json({ success: false, message: 'Message ID not provided' });
    }
    
    console.log(`Processing webhook event ${event.type} for message ID: ${messageId}`);
    
    switch (event.type) {
      case 'email.opened':
        result = await EmailLog.markOpened(messageId);
        break;
      case 'email.clicked':
        result = await EmailLog.markClicked(messageId);
        break;
      case 'email.delivered':
        result = await EmailLog.updateStatus(messageId, 'delivered');
        break;
      case 'email.bounced':
        result = await EmailLog.updateStatus(messageId, 'bounced');
        break;
      case 'email.complained':
        result = await EmailLog.updateStatus(messageId, 'complained');
        break;
      case 'email.delivery_delayed':
        result = await EmailLog.updateStatus(messageId, 'delayed');
        break;
      default:
        console.log(`Unhandled Resend event type: ${event.type}`);
    }
    
    console.log(`Webhook processing result: ${result ? 'Updated' : 'No change'}`);
    
    return res.status(200).json({
      success: true,
      message: `Event ${event.type} processed`,
      updated: result,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing webhook',
      environment: process.env.NODE_ENV || 'development'
    });
  }
};

// Get recent emails for dashboard
const getRecentEmails = async (req, res) => {
  try {
    const recentEmails = await EmailLog.getRecentWithDetails(5);
    res.json({
      success: true,
      emails: recentEmails
    });
  } catch (error) {
    console.error('Error fetching recent emails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent emails',
      error: error.message
    });
  }
};

// Check if webhooks are properly set up
const checkWebhookSetup = (req, res, next) => {
  // Always set webhookSetup to true since it's already set up
  res.locals.webhookSetup = true;
  next();
};

/**
 * Controller exports
 */
module.exports = {
  selectForm,
  sendEmails,
  viewEmailLogs,
  handleResendWebhook,
  getRecentEmails,
  checkWebhookSetup
}; 