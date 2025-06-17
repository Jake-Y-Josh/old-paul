const Settings = require('../models/settings');
const { sendTestEmail } = require('../utils/mailer');

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

// Test email configuration
const testEmailConfig = async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Test email address is required'
      });
    }
    
    const result = await sendTestEmail(testEmail);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully'
      });
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email: ' + error.message
    });
  }
};

module.exports = {
  showSettings,
  updateEmailSettings,
  testEmailConfig
}; 