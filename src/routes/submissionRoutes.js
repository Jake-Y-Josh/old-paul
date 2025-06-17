const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth');
const submissionController = require('../controllers/submissionController');

// Submissions routes
router.get('/', isAuthenticated, submissionController.submissionsPage);
router.get('/:id', isAuthenticated, submissionController.viewSubmission);
router.delete('/:id/delete', isAuthenticated, submissionController.deleteSubmission);

// Export submissions routes
module.exports = router; 