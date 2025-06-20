const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { isAuthenticated, isNotAuthenticated } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');
const formController = require('../controllers/formController');
const clientController = require('../controllers/admin/clientController');
const emailController = require('../controllers/emailController');
const settingsController = require('../controllers/settingsController');
const userRoutes = require('./admin/userRoutes');
const submissionController = require('../controllers/submissionController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    if (file.mimetype === 'text/csv' || 
        file.originalname.endsWith('.csv') ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel (.xlsx) files are allowed'));
    }
  }
});

// Authentication routes
router.get('/login', isNotAuthenticated, adminController.loginPage);
router.post('/login', isNotAuthenticated, adminController.login);
router.get('/logout', adminController.logout);

// Password reset routes
router.get('/forgot-password', isNotAuthenticated, adminController.forgotPasswordPage);
router.post('/forgot-password', isNotAuthenticated, adminController.forgotPassword);
router.get('/reset-password', isNotAuthenticated, adminController.resetPasswordPage); // Supabase uses query params
router.post('/reset-password', isNotAuthenticated, adminController.resetPassword);

// Invitation routes
const userController = require('../controllers/userController');
router.get('/accept-invitation', isNotAuthenticated, userController.acceptInvitationPage);
router.post('/accept-invitation', isNotAuthenticated, userController.acceptInvitation);

// Dashboard
router.get('/dashboard', isAuthenticated, adminController.dashboard);

// Submissions routes are handled by submissionRoutes.js (mounted at /admin/submissions in app.js)

// Form management
router.get('/forms', isAuthenticated, formController.listForms);
router.get('/forms/create', isAuthenticated, formController.createFormPage);
router.post('/forms/create', isAuthenticated, formController.createForm);
router.get('/forms/:id/edit', isAuthenticated, formController.editFormPage);
router.put('/forms/:id', isAuthenticated, formController.updateForm);
router.delete('/forms/:id', isAuthenticated, formController.deleteForm);
router.get('/forms/:id/submissions', isAuthenticated, formController.viewSubmissions);

// Client management
router.get('/clients', isAuthenticated, clientController.listClients);
router.get('/clients/upload', isAuthenticated, clientController.showUploadForm);
router.post('/clients/upload', isAuthenticated, upload.single('file'), clientController.uploadClients);
router.get('/clients/import-preview', isAuthenticated, clientController.showImportPreview);
router.post('/clients/import-confirm', isAuthenticated, clientController.confirmImport);
router.post('/clients/create', isAuthenticated, clientController.createClient);
router.put('/clients/:id', isAuthenticated, clientController.updateClient);
router.delete('/clients/:id', isAuthenticated, clientController.deleteClient);

// Email management
router.get('/emails/send', isAuthenticated, emailController.selectForm);
router.post('/emails/send', isAuthenticated, emailController.sendEmails);
router.get('/emails/logs', isAuthenticated, emailController.viewEmailLogs);
router.get('/emails/recent', isAuthenticated, emailController.getRecentEmails);
router.post('/emails/logs/:id/delete', isAuthenticated, emailController.deleteEmailLog);
router.post('/emails/logs/delete-multiple', isAuthenticated, emailController.deleteMultipleEmailLogs);

// Webhook endpoint for email tracking events (no auth needed for external service)
router.post('/emails/webhook', emailController.handleResendWebhook);

// Admin registration (could be restricted to super-admin in a real app)
router.post('/register', isAuthenticated, adminController.register);

// User management routes
router.use('/users', userRoutes);

// Settings routes
router.get('/settings', isAuthenticated, settingsController.showSettings);
router.post('/settings/update', isAuthenticated, settingsController.updateSettings);
router.post('/settings/email', isAuthenticated, settingsController.updateEmailSettings);
router.post('/settings/test-email', isAuthenticated, settingsController.testEmailConfig);

module.exports = router; 