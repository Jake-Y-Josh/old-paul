const Submission = require('../models/submission');
const Form = require('../models/form');
const logger = require('../utils/logger');

/**
 * Render the submissions overview page
 */
const submissionsPage = async (req, res) => {
  try {
    // Get all submissions with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const submissions = await Submission.getAll(limit, offset);
    const totalCount = await Submission.getTotalCount();
    const totalPages = Math.ceil(totalCount / limit);
    
    // Extract messages from flash
    const success = req.flash('success')[0] || null;
    const error = req.flash('error')[0] || null;
    
    res.render('admin/submissions', {
      title: 'Submissions',
      submissions,
      currentPage: page,
      totalPages,
      success,
      error,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error loading submissions page:', error);
    req.flash('error', 'Failed to load submissions');
    res.redirect('/admin/dashboard');
  }
};

/**
 * Render a specific submission
 */
const viewSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const submission = await Submission.getById(id);
    
    if (!submission) {
      req.flash('error', 'Submission not found');
      return res.redirect('/admin/submissions');
    }
    
    res.render('admin/submission-detail', {
      title: 'View Submission',
      submission,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error viewing submission:', error);
    req.flash('error', 'Failed to load submission details');
    res.redirect('/admin/submissions');
  }
};

/**
 * Get recent submissions for the dashboard
 */
exports.getRecentSubmissions = async (req, res) => {
  try {
    const recentSubmissions = await Submission.getRecent(5); // Get 5 most recent submissions
    res.json({ success: true, submissions: recentSubmissions });
  } catch (error) {
    logger.error('Error getting recent submissions:', error);
    res.status(500).json({ success: false, message: 'Failed to load recent submissions' });
  }
};

/**
 * Delete a submission
 */
const deleteSubmission = async (req, res) => {
  try {
    console.log('Delete submission request:', {
      id: req.params.id,
      method: req.method,
      headers: req.headers,
      xhr: req.xhr
    });
    
    const { id } = req.params;
    const result = await Submission.delete(id);
    
    if (!result) {
      console.log('Submission not found or already deleted:', id);
      // Check if this is an AJAX request
      if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(404).json({ success: false, message: 'Submission not found' });
      }
      req.flash('error', 'Submission not found');
      return res.redirect('/admin/submissions');
    }
    
    console.log('Submission deleted successfully:', id);
    
    // Check if this is an AJAX request
    if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ success: true, message: 'Submission deleted successfully' });
    }
    
    req.flash('success', 'Submission deleted successfully');
    res.redirect('/admin/submissions');
  } catch (error) {
    console.error('Error deleting submission:', error);
    
    // Check if this is an AJAX request
    if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ success: false, message: 'Failed to delete submission: ' + error.message });
    }
    
    req.flash('error', 'Failed to delete submission');
    res.redirect('/admin/submissions');
  }
};

module.exports = {
  submissionsPage,
  viewSubmission,
  deleteSubmission
}; 