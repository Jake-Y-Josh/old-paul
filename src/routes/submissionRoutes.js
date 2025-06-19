const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth');
const submissionController = require('../controllers/submissionController');

// Submissions routes
router.get('/', isAuthenticated, submissionController.submissionsPage);
router.get('/:id', isAuthenticated, submissionController.viewSubmission);

// Add logging for the delete route
router.delete('/:id/delete', isAuthenticated, (req, res, next) => {
  console.log('DELETE route hit in submissionRoutes.js:', req.params);
  next();
}, submissionController.deleteSubmission);

// Export submissions routes
module.exports = router; 