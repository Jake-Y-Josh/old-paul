const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../../middlewares/auth');
const userController = require('../../controllers/userController');

// User management routes
router.get('/', isAuthenticated, userController.listUsers);
router.get('/create', isAuthenticated, userController.createUserPage);
router.post('/create', isAuthenticated, userController.createUser);
router.get('/:id/edit', isAuthenticated, userController.editUserPage);
router.put('/:id', isAuthenticated, userController.updateUser);
router.delete('/:id', isAuthenticated, userController.deleteUser);

module.exports = router; 