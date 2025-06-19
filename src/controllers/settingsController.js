const Settings = require('../models/settings');

/**
 * Settings Controller
 */

// Show settings page
const showSettings = async (req, res) => {
  try {
    // Get all settings with proper fallbacks
    const settings = await Settings.getAll();
    
    // Convert array of settings to object format expected by template
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: setting.value,
        description: setting.description
      };
      return acc;
    }, {});

    res.render('admin/settings', {
      title: 'System Settings',
      settings: settingsObj,
      success: req.query.success,
      error: req.query.error,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.render('error', {
      message: 'Failed to load settings',
      error,
      layout: false
    });
  }
};

// Update email settings
const updateEmailSettings = async (req, res) => {
  try {
    const { emailTemplate, signature } = req.body;
    
    // Validate required fields
    if (!emailTemplate || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Email template and signature are required'
      });
    }
    
    // Update settings
    await Settings.update({
      emailTemplate,
      signature
    });
    
    res.json({
      success: true,
      message: 'Email settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating email settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email settings'
    });
  }
};

// Update main settings (EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_REPLY_TO, NOTIFICATION_EMAILS)
const updateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings) {
      return res.redirect('/admin/settings?error=No settings provided');
    }
    
    // Update each setting in the database
    const settingsToUpdate = [
      'EMAIL_FROM',
      'EMAIL_FROM_NAME', 
      'EMAIL_REPLY_TO',
      'NOTIFICATION_EMAILS'
    ];
    
    for (const key of settingsToUpdate) {
      if (settings[key] !== undefined) {
        await Settings.set(key, settings[key], Settings.getDescriptionForKey(key));
      }
    }
    
    res.redirect('/admin/settings?success=Settings updated successfully');
  } catch (error) {
    console.error('Error updating settings:', error);
    res.redirect('/admin/settings?error=' + encodeURIComponent('Failed to update settings: ' + error.message));
  }
};

// Test email configuration
const testEmailConfig = async (_req, res) => {
  try {
    // For testing the connection, we don't need a specific email address
    // We'll just verify the SMTP connection
    const { verifyTransporter } = require('../utils/mailer');
    
    const verified = await verifyTransporter();
    
    if (verified) {
      res.json({
        success: true,
        message: 'SMTP connection verified successfully. Email configuration is working.'
      });
    } else {
      res.json({
        success: false,
        message: 'SMTP connection failed. Please check your email configuration.'
      });
    }
  } catch (error) {
    console.error('Error testing email configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test email configuration: ' + error.message
    });
  }
};

module.exports = {
  showSettings,
  updateSettings,
  updateEmailSettings,
  testEmailConfig
}; 