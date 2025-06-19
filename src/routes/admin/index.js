const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const formRoutes = require('./formRoutes');
const clientRoutes = require('./clientRoutes');
const authMiddleware = require('../../middlewares/auth');

// Auth routes (login, logout)
router.use('/', authRoutes);

// Apply auth middleware to all routes below
router.use(authMiddleware.isAuthenticated);

// Dashboard routes
router.use('/dashboard', dashboardRoutes);

// Form management routes
router.use('/forms', formRoutes);

// Client management routes
router.use('/clients', clientRoutes);

module.exports = router; 