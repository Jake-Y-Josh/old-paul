const Form = require('../models/form');
const Client = require('../models/client');
const Submission = require('../models/submission');
const EmailLog = require('../models/emailLog');

const dashboard = async (req, res) => {
  try {
    // Get counts for dashboard stats
    const totalForms = await Form.count();
    const totalClients = await Client.count();
    const totalSubmissions = await Submission.count();
    const totalEmails = await EmailLog.count();
    
    // Get emails opened and clicked counts for metrics
    const openedEmails = await EmailLog.countOpened();
    const clickedEmails = await EmailLog.countClicked();
    
    // Get recent emails for dashboard
    const recentEmails = await EmailLog.getRecent(5);
    
    // Get recent submissions for dashboard
    const recentSubmissions = await Submission.getRecent(5);
    
    // Render dashboard with data
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      username: req.session.username,
      stats: {
        totalForms,
        totalClients,
        totalSubmissions,
        totalEmails,
        openedEmails,
        clickedEmails
      },
      recentEmails,
      recentSubmissions
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.render('error', {
      message: 'Failed to load dashboard',
      error,
      layout: false
    });
  }
};

module.exports = {
  dashboard
}; 