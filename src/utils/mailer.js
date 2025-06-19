const nodemailer = require('nodemailer');
const EmailLog = require('../models/emailLog');
let Settings;
try {
  Settings = require('../models/settings');
} catch (e) {
  // Settings model not available
}
require('dotenv').config();

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'test@example.com',
    pass: process.env.SMTP_PASS || 'password123'
  }
});

// Default email configuration with environment variable fallbacks
const emailConfig = {
  fromName: process.env.EMAIL_FROM_NAME || 'Dynamic FP Feedback',
  fromEmail: process.env.EMAIL_FROM || 'feedback@dynamic-fp.co.uk',
  replyTo: process.env.EMAIL_REPLY_TO || 'enquiries@dynamic-fp.co.uk'
};

/**
 * Get email configuration from database or environment variables
 * @returns {Promise<Object>} Email configuration
 */
const getEmailConfig = async () => {
  try {
    // Try to get settings from database first
    if (Settings) {
      const dbSettings = await Settings.getMultiple([
        'EMAIL_FROM', 
        'EMAIL_FROM_NAME', 
        'EMAIL_REPLY_TO'
      ]);
      
      return {
        fromName: dbSettings.EMAIL_FROM_NAME || emailConfig.fromName,
        fromEmail: dbSettings.EMAIL_FROM || emailConfig.fromEmail,
        replyTo: dbSettings.EMAIL_REPLY_TO || emailConfig.replyTo
      };
    }
  } catch (error) {
    console.error('Error getting email config from database:', error);
    // Fall back to env vars
  }
  
  // Return default config from env vars
  return emailConfig;
};

// Verify the transporter connection
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('SMTP connection verification failed:', error);
    return false;
  }
};

/**
 * Log an email to the database
 * @param {Object} data - Email data to log
 * @returns {Promise<Object>} - Logged email data
 */
const logEmail = async (data) => {
  try {
    // Prepare log data
    const logData = {
      client_id: data.client_id || null,
      form_id: data.form_id || null,
      to_email: data.to_email || data.recipient || data.to || '',
      subject: data.subject || '',
      message_id: data.message_id || data.messageId || '',
      status: data.status || 'sent',
      type: data.type || 'other',
      error: data.error || null,
      sent_at: data.sent_at || new Date()
    };
    
    console.log('[EMAIL LOGGING] Logging email with message ID:', logData.message_id);
    
    // Use EmailLog model
    const result = await EmailLog.create(logData);
    
    console.log('[EMAIL LOGGING] Email logged successfully:', {
      to: logData.to_email,
      subject: logData.subject,
      status: logData.status,
      type: logData.type,
      messageId: logData.message_id,
      time: logData.sent_at.toISOString()
    });
    
    return result || {
      id: 0,
      to_email: logData.to_email,
      subject: logData.subject,
      message_id: logData.message_id,
      status: logData.status,
      type: logData.type,
      error: logData.error,
      sent_at: logData.sent_at,
      created_at: new Date(),
      updated_at: new Date()
    };
  } catch (error) {
    console.error('[ERROR] Error logging email:', error);
    return {
      id: 0,
      to_email: data.to_email || data.to || data.recipient || '',
      subject: data.subject || '',
      message_id: data.message_id || data.messageId || '',
      status: 'error',
      type: data.type || 'other',
      error: error.message,
      sent_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
  }
};

// Helper function to get email template and signature
async function getEmailTemplate() {
  try {
    if (Settings && typeof Settings.get === 'function') {
      const settings = await Settings.get();
      return {
        template: settings?.emailTemplate || getDefaultTemplate(),
        signature: settings?.signature || getDefaultSignature()
      };
    }
  } catch (error) {
    console.error('Error getting email template from settings:', error);
  }
  
  // Return defaults if Settings not available or error occurs
  return {
    template: getDefaultTemplate(),
    signature: getDefaultSignature()
  };
}

function getDefaultTemplate() {
  return `Dear {clientName},

I hope this email finds you well. I would greatly appreciate your feedback on our recent services.

Please take a moment to complete this brief feedback form: {formTitle}

You can access the form here: {formLink}

Thank you for your time and valuable feedback.

Best regards,`;
}

function getDefaultSignature() {
  return {
    name: 'Paul Campion',
    title: 'Chartered Financial Planner',
    contact: '07966 138 408\n01494 327 320\nThe Stables, Manor Courtyard, Aston Sandford, Buckinghamshire. HP17 8JB',
    logoUrl: '/images/Dynamic-Orange.svg',
    legal: 'Dynamic FP is a trading name of Dynamic Financial Planning Ltd who is an appointed representative of Best Practice IFA Group Limited which is authorised and regulated by the Financial Conduct Authority, registration number 223112.\nRegistered office Barney Cottage, 2 Southend, Haddenham, Buckinghamshire.  HP17 8BH.  Registered in England under number 14946756'
  };
}

// Helper function to generate HTML signature
function generateSignature(signature) {
  return `
    <div style="font-family: Arial, sans-serif; margin-top: 20px;">
      <div style="font-size: 18px; font-weight: 700; font-style: italic; color: #00a0dc;">${signature.name}</div>
      <div style="font-size: 16px; font-style: italic; color: #ff6b00; font-weight: 300;">${signature.title}</div>
      <hr style="border-top: 1px solid #ddd; margin: 10px 0;">
      <div style="color: #00a0dc; font-size: 14px;">${signature.contact.replace(/\n/g, '<br>')}</div>
      <hr style="border-top: 1px solid #ddd; margin: 10px 0;">
      <img src="${signature.logoUrl}" alt="Dynamic Financial Planning" style="max-width: 200px; height: auto;">
      <div style="font-size: 11px; color: #666; margin-top: 10px;">${signature.legal.replace(/\n/g, '<br>')}</div>
    </div>
  `;
}

/**
 * Send a feedback form email to a client
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.clientName - Client name
 * @param {string} options.formTitle - Form title
 * @param {string} options.formLink - Form link URL
 * @returns {Promise<Object>} - Email send result
 */
const sendFeedbackFormEmail = async (options) => {
  try {
    const { to, clientName, formTitle, formLink, clientId, formId } = options;
    
    // Get the latest email config (from database or env vars)
    const config = await getEmailConfig();
    
    // Get email template and signature
    const { template, signature } = await getEmailTemplate();
    
    // Replace template variables
    const emailContent = template
      .replace(/{clientName}/g, clientName)
      .replace(/{formTitle}/g, formTitle)
      .replace(/{formLink}/g, formLink);
    
    // Generate HTML email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        ${emailContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}
        ${generateSignature(signature)}
      </div>
    `;
    
    // Track success for fallback
    let success = false;
    let messageId = '';
    
    try {
      // Try to send the email
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        replyTo: config.replyTo,
        subject: `Feedback Request - ${formTitle}`,
        text: `${emailContent}\n\n${signature.name}\n${signature.title}\n\n${signature.contact}\n\n${signature.legal}`,
        html: htmlContent
      });
      success = true;
      messageId = info.messageId;
    } catch (emailError) {
      console.error('Transporter error sending feedback form email:', emailError);
      
      // Always throw the error so we can see what's wrong
      throw emailError;
    }
    
    // Log the email, using the updated robust helper
    await logEmail({
      recipient: to,
      to_email: to,
      client_id: clientId,
      form_id: formId,
      subject: `Feedback Request - ${formTitle}`,
      message_id: messageId,
      status: success ? 'sent' : 'failed',
      type: 'feedback_request'
    });
    
    return { success, messageId };
  } catch (error) {
    console.error('Error in sendFeedbackFormEmail:', error);
    
    // Log the failed email with the upgraded logger
    await logEmail({
      recipient: options.to,
      to_email: options.to,
      client_id: options.clientId,
      form_id: options.formId,
      subject: `Feedback Request - ${options.formTitle}`,
      status: 'failed',
      error: error.message,
      type: 'feedback_request'
    });
    
    return { success: false, error: error.message };
  }
};

/**
 * Send a password reset email to an admin
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.resetLink - Password reset link URL
 * @param {string} options.adminName - Admin name (optional)
 * @returns {Promise<Object>} - Email send result
 */
const sendPasswordResetEmail = async (options) => {
  try {
    const { to, resetLink, adminName } = options;
    
    console.log('[PASSWORD RESET] Starting password reset email for:', to);
    
    // Get the latest email config (from database or env vars)
    const config = await getEmailConfig();
    console.log('[PASSWORD RESET] Email config:', config);
    
    // Email content
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: to,
      replyTo: config.replyTo,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://dynamic-fp.co.uk/wp-content/uploads/2023/03/Dynamic-FP-Logo.png" alt="Dynamic FP" style="max-width: 200px;">
          </div>
          <h2 style="color: #00546c; margin-bottom: 20px;">Password Reset Request</h2>
          <p>Hello${adminName ? ` ${adminName}` : ''},</p>
          <p>We received a request to reset your password for the Dynamic FP Feedback System. If you didn't make this request, you can safely ignore this email.</p>
          <p>To reset your password, click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #ff5204; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${resetLink}" style="color: #00546c; word-break: break-all;">${resetLink}</a></p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This email was sent from Dynamic FP Feedback System. If you have any questions, please contact us at ${config.replyTo}</p>
            <p>If you did not request a password reset, please contact the system administrator immediately.</p>
          </div>
        </div>
      `
    };
    
    // Track success for fallback
    let success = false;
    let messageId = '';
    
    try {
      // Try to send the email
      const info = await transporter.sendMail(mailOptions);
      success = true;
      messageId = info.messageId;
    } catch (emailError) {
      console.error('Transporter error sending password reset email:', emailError);
      console.error('Full error details:', {
        message: emailError.message,
        code: emailError.code,
        response: emailError.response,
        responseCode: emailError.responseCode
      });
      
      // Always throw the error so we can see what's wrong
      throw emailError;
    }
    
    // Log the email
    await logEmail({
      recipient: to,
      to_email: to,
      subject: mailOptions.subject,
      message_id: messageId,
      status: success ? 'sent' : 'failed',
      type: 'password_reset'
    });
    
    return { success, messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    
    // Log the failed email
    await logEmail({
      recipient: options.to,
      to_email: options.to,
      subject: 'Password Reset Request',
      status: 'failed',
      error: error.message,
      type: 'password_reset'
    });
    
    return { success: false, error: error.message };
  }
};

/**
 * Send a notification email when a form is submitted
 * @param {Object} options - Email options
 * @param {string} options.clientName - Client name who submitted the form
 * @param {string} options.formTitle - Form title that was submitted
 * @param {string} options.submissionId - ID of the submission for reference
 * @returns {Promise<Object>} - Email send result
 */
const sendSubmissionNotificationEmail = async (options) => {
  let recipients = [];
  
  try {
    const { clientName, formTitle, submissionId } = options;
    
    // Get notification email addresses from settings
    let notificationEmails = '';
    if (Settings) {
      notificationEmails = await Settings.get('NOTIFICATION_EMAILS') || '';
    }
    
    // If no notification emails are set, don't send anything
    if (!notificationEmails || notificationEmails.trim() === '') {
      console.log('No notification emails configured. Skipping submission notification.');
      return { success: false, skipped: true };
    }
    
    // Parse multiple email addresses
    recipients = notificationEmails.split(',').map(email => email.trim()).filter(email => email);
    
    if (recipients.length === 0) {
      console.log('No valid notification emails found. Skipping submission notification.');
      return { success: false, skipped: true };
    }
    
    // Get the latest email config (from database or env vars)
    const config = await getEmailConfig();
    
    // Build the admin dashboard URL
    const dashboardUrl = process.env.APP_URL 
      ? `${process.env.APP_URL}/admin/forms/${options.formId}/submissions`
      : `/admin/forms/${options.formId}/submissions`;
    
    // Email content
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipients.join(', '),
      replyTo: config.replyTo,
      subject: `New Form Submission: ${formTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${process.env.APP_URL || ''}/images/dynamic-chev.png" alt="Dynamic FP" style="max-width: 200px;">
          </div>
          <h2 style="color: #00546c; margin-bottom: 20px;">New Form Submission</h2>
          <p>A new submission has been received for the following form:</p>
          <p><strong>Form:</strong> ${formTitle}</p>
          <p><strong>Client:</strong> ${clientName}</p>
          <p><strong>Submission ID:</strong> ${submissionId}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background-color: #ff5204; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Submission</a>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This is an automated notification from the Dynamic FP Feedback System.</p>
          </div>
        </div>
      `
    };
    
    // Track success for fallback
    let success = false;
    let messageId = '';
    
    try {
      // Try to send the email
      const info = await transporter.sendMail(mailOptions);
      success = true;
      messageId = info.messageId;
    } catch (emailError) {
      console.error('Transporter error sending notification email:', emailError);
      
      // In development, simulate success
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEV MODE: Simulating successful notification email to:', recipients.join(', '));
        success = true;
        messageId = `dev-${Date.now()}@local`;
      } else {
        throw emailError; // Rethrow in production
      }
    }
    
    // Log the email
    await logEmail({
      to_email: recipients.join(', '),
      subject: mailOptions.subject,
      message_id: messageId,
      status: success ? 'sent' : 'failed',
      type: 'submission_notification',
      error: success ? null : 'Email sending failed'
    });
    
    return { success, messageId };
  } catch (error) {
    console.error('Error sending notification email:', error);
    
    // Log the failed email with actual recipients
    await logEmail({
      to_email: recipients ? recipients.join(', ') : '',
      subject: `New Form Submission: ${options.formTitle}`,
      status: 'failed',
      error: error.message || 'Unknown error',
      type: 'submission_notification'
    });
    
    return { success: false, error: error.message };
  }
};

/**
 * Send an invitation email to a new admin user
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.username - Username for the new admin
 * @param {string} options.invitationLink - Invitation link URL
 * @returns {Promise<Object>} - Email send result
 */
const sendInvitationEmail = async (options) => {
  try {
    const { to, username, invitationLink } = options;
    
    console.log('[INVITATION EMAIL] Starting invitation email for:', to);
    
    // Get the latest email config (from database or env vars)
    const config = await getEmailConfig();
    console.log('[INVITATION EMAIL] Email config:', config);
    
    // Email content
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: to,
      replyTo: config.replyTo,
      subject: 'Welcome to Dynamic FP - Set Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://dynamic-fp.co.uk/wp-content/uploads/2023/03/Dynamic-FP-Logo.png" alt="Dynamic FP" style="max-width: 200px;">
          </div>
          <h2 style="color: #00546c; margin-bottom: 20px;">Welcome to Dynamic FP Feedback System</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>You have been invited to join the Dynamic FP Feedback System as an administrator. To complete your account setup, please create your password.</p>
          <p>To set your password and activate your account, click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" style="background-color: #ff5204; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Set Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${invitationLink}" style="color: #00546c; word-break: break-all;">${invitationLink}</a></p>
          <p><strong>Password Requirements:</strong></p>
          <ul style="color: #666; font-size: 14px;">
            <li>At least 8 characters long</li>
            <li>At least one uppercase letter</li>
            <li>At least one lowercase letter</li>
            <li>At least one number</li>
            <li>At least one special character (!@#$%^&*)</li>
          </ul>
          <p>This invitation link will expire in 24 hours for security reasons.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This email was sent from Dynamic FP Feedback System. If you have any questions, please contact us at ${config.replyTo}</p>
            <p>If you did not expect this invitation, please contact the system administrator immediately.</p>
          </div>
        </div>
      `
    };
    
    // Track success for fallback
    let success = false;
    let messageId = '';
    
    try {
      // Try to send the email
      const info = await transporter.sendMail(mailOptions);
      success = true;
      messageId = info.messageId;
    } catch (emailError) {
      console.error('Transporter error sending invitation email:', emailError);
      console.error('Full error details:', {
        message: emailError.message,
        code: emailError.code,
        response: emailError.response,
        responseCode: emailError.responseCode
      });
      
      // Always throw the error so we can see what's wrong
      throw emailError;
    }
    
    // Log the email
    await logEmail({
      recipient: to,
      to_email: to,
      subject: mailOptions.subject,
      message_id: messageId,
      status: success ? 'sent' : 'failed',
      type: 'invitation'
    });
    
    return { success, messageId };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    
    // Log the failed email
    await logEmail({
      recipient: options.to,
      to_email: options.to,
      subject: 'Welcome to Dynamic FP - Set Your Password',
      status: 'failed',
      error: error.message,
      type: 'invitation'
    });
    
    return { success: false, error: error.message };
  }
};

/**
 * Send a test email to verify configuration
 * @param {string} testEmail - Email address to send test to
 * @returns {Promise<Object>} - Test result
 */
const sendTestEmail = async (testEmail) => {
  try {
    // First verify the transporter
    const verified = await verifyTransporter();
    if (!verified) {
      return { success: false, error: 'SMTP connection failed' };
    }
    
    // Get the latest email config (from database or env vars)
    const config = await getEmailConfig();
    
    // Send test email
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: testEmail,
      replyTo: config.replyTo,
      subject: 'Test Email - Dynamic FP Feedback System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #00546c;">Test Email Successful</h2>
          <p>This is a test email from the Dynamic FP Feedback System.</p>
          <p>If you received this email, your email configuration is working correctly.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            Email sent from: ${config.fromEmail}<br>
            Reply-to: ${config.replyTo}
          </p>
        </div>
      `
    });
    
    return { success: true, message: 'Test email sent successfully' };
  } catch (error) {
    console.error('Error sending test email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  verifyTransporter,
  sendFeedbackFormEmail,
  sendPasswordResetEmail,
  sendSubmissionNotificationEmail,
  sendInvitationEmail,
  sendTestEmail
}; 