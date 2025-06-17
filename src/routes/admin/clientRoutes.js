const express = require('express');
const router = express.Router();
const clientController = require('../../controllers/admin/clientController');
const { body } = require('express-validator');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware.isAuthenticated);

// GET /admin/clients - List all clients
router.get('/', clientController.listClients);

// GET /admin/clients/upload - Show CSV upload form
router.get('/upload', clientController.showUploadForm);

// POST /admin/clients/upload - Process file upload
router.post('/upload', clientController.uploadClients);

// POST /admin/clients/create - Create a new client
router.post('/create', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('extraData').optional()
], clientController.createClient);

// PUT /admin/clients/:id - Update a client
router.put('/:id', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required')
], clientController.updateClient);

// DELETE /admin/clients/:id - Delete a client
router.delete('/:id', clientController.deleteClient);

module.exports = router; 