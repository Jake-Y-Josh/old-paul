const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');

// Public feedback form routes
router.get('/feedback/thank-you', feedbackController.thankYouPage);
router.get('/feedback/:id', feedbackController.showFeedbackForm);
router.post('/feedback/:id/submit', feedbackController.submitFeedback);

module.exports = router; 