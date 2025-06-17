const Client = require('../models/client');
const FeedbackForm = require('../models/feedbackForm');
const FeedbackSubmission = require('../models/feedbackSubmission');

/**
 * Feedback Controller (client-facing)
 */

// Render the feedback form
const showFeedbackForm = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.query.client;
    
    // Get the form
    const form = await FeedbackForm.getById(id);
    
    if (!form) {
      return res.render('public/error', {
        message: 'Feedback form not found',
        layout: false
      });
    }
    
    // Get client data if a client ID was provided
    let client = null;
    let hasSubmitted = false;
    
    if (clientId) {
      client = await Client.getById(clientId);
      
      // Check if this client has already submitted this form
      if (client) {
        hasSubmitted = await FeedbackSubmission.hasClientSubmitted(clientId, id);
      }
    }
    
    res.render('public/feedback-form', {
      title: form.title,
      form,
      client,
      hasSubmitted,
      layout: false
    });
  } catch (error) {
    console.error('Error showing feedback form:', error);
    res.render('public/error', {
      message: 'Failed to load feedback form',
      error: error.message,
      layout: false
    });
  }
};

// Submit feedback
const submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, answers } = req.body;
    
    // Validate required fields
    if (!answers) {
      return res.render('public/error', { 
        message: 'Please provide answers to the questions',
        layout: false
      });
    }
    
    // Get the form
    const form = await FeedbackForm.getById(id);
    
    if (!form) {
      return res.render('public/error', { 
        message: 'Feedback form not found',
        layout: false
      });
    }
    
    // Check if a valid client ID was provided
    let client = null;
    
    if (clientId) {
      client = await Client.getById(clientId);
      
      // Check if client already submitted this form
      if (client) {
        const hasSubmitted = await FeedbackSubmission.hasClientSubmitted(clientId, id);
        
        if (hasSubmitted) {
          return res.render('public/error', { 
            message: 'You have already submitted feedback for this form',
            layout: false
          });
        }
      }
    }
    
    // Convert answers to proper JSON format if it's not already
    let formattedAnswers = answers;
    if (typeof answers !== 'string') {
      try {
        // Convert array-like form structure to proper JSON object
        formattedAnswers = JSON.stringify(answers);
      } catch (jsonError) {
        console.error('Error formatting answer data:', jsonError);
        return res.render('public/error', { 
          message: 'Error processing your feedback. Please try again.',
          layout: false
        });
      }
    }
    
    // Create the submission
    const submission = await FeedbackSubmission.create(
      clientId || null,
      id,
      formattedAnswers
    );
    
    // Send notification email about the new submission
    try {
      const mailer = require('../utils/mailer');
      await mailer.sendSubmissionNotificationEmail({
        clientName: client ? client.name : 'Anonymous User',
        formTitle: form.title,
        submissionId: submission.id,
        formId: id
      });
    } catch (emailError) {
      // Log but don't fail if email notification fails
      console.error('Failed to send submission notification email:', emailError);
    }
    
    // Redirect to thank you page
    return res.redirect('/feedback/thank-you');
  } catch (error) {
    console.error('Feedback submission error:', error);
    return res.render('public/error', { 
      message: 'Failed to submit feedback: ' + error.message,
      layout: false
    });
  }
};

// Render thank you page after submission
const thankYouPage = (req, res) => {
  res.render('public/thank-you', {
    title: 'Thank You',
    layout: false
  });
};

module.exports = {
  showFeedbackForm,
  submitFeedback,
  thankYouPage
}; 