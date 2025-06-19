const Client = require('../../models/client');
const Form = require('../../models/form');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const multer = require('multer');
const logger = require('../../utils/logger');
const { processClientExcel, validateExcelFormat } = require('../../utils/excelProcessor');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'clients-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept CSV and Excel files
    if (file.mimetype === 'text/csv' || 
        file.originalname.endsWith('.csv') ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      return cb(new Error('Only CSV and Excel (.xlsx) files are allowed'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 10 // 10MB max file size
  }
}).single('file');

// List all clients
exports.listClients = async (req, res) => {
  try {
    const clients = await Client.findAll();
    const forms = await Form.findAll();
    
    res.render('admin/clients/list', {
      title: 'Client Management',
      username: req.session.user ? req.session.user.username : req.session.username,
      clients: clients,
      forms: forms,
      success: req.flash('success')[0] || req.query.success || null,
      error: req.flash('error')[0] || req.query.error || null
    });
  } catch (error) {
    logger.error('Error listing clients:', error);
    req.flash('error', 'Failed to load clients. Please try again.');
    res.redirect('/admin/dashboard');
  }
};

// Show client upload form
exports.showUploadForm = (req, res) => {
  res.render('admin/clients/upload', {
    title: 'Import Clients',
    username: req.session.user.username
  });
};

// Create a new client
exports.createClient = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const { name, email, extraData } = req.body;
    
    // Check if client with this email already exists
    const existingClient = await Client.findByEmail(email);
    if (existingClient) {
      return res.status(400).json({ 
        success: false, 
        message: 'A client with this email already exists' 
      });
    }
    
    // Create the client
    const client = await Client.create({
      name,
      email,
      extraData: extraData || {}
    });
    
    return res.status(201).json({ 
      success: true, 
      message: 'Client created successfully',
      client: client
    });
  } catch (error) {
    logger.error('Error creating client:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create client. Please try again.' 
    });
  }
};

// Update an existing client
exports.updateClient = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const clientId = req.params.id;
    const { name, email } = req.body;
    
    // Check if client exists
    const existingClient = await Client.findById(clientId);
    if (!existingClient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }
    
    // Check if email is being changed and already exists on another client
    if (email.toLowerCase() !== existingClient.email.toLowerCase()) {
      const emailExists = await Client.findByEmail(email);
      if (emailExists && emailExists.id !== parseInt(clientId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'A client with this email already exists' 
        });
      }
    }
    
    // Update the client
    const updatedClient = await Client.update(clientId, {
      name,
      email
    });
    
    return res.status(200).json({ 
      success: true, 
      message: 'Client updated successfully',
      client: updatedClient
    });
    
  } catch (error) {
    logger.error('Error updating client:', error);
    
    // Handle specific error cases
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    if (error.code === '23505') { // PostgreSQL unique violation
      return res.status(400).json({
        success: false,
        message: 'A client with this email already exists'
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred while updating the client. Please try again.'
    });
  }
};

// Upload and process client file (CSV or Excel)
exports.uploadClients = async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      req.flash('error', err.message || 'Error uploading file');
      return res.redirect('/admin/clients/upload');
    }
    
    if (!req.file) {
      req.flash('error', 'Please select a file to upload');
      return res.redirect('/admin/clients/upload');
    }
    
    try {
      const filePath = req.file.path;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const clientIdField = req.body.clientIdField || 'Client ID';
      const updateExisting = req.body.updateExisting === 'on';
      
      let clients = [];
      let isValid = false;
      
      // Process file based on extension
      if (fileExtension === '.xlsx') {
        // Validate Excel format
        isValid = await validateExcelFormat(filePath);
        
        if (!isValid) {
          // Delete the uploaded file
          fs.unlinkSync(filePath);
          
          req.flash('error', 'Invalid Excel format. File must include name and email columns (e.g., "name", "Client Forename/Surname", "email", "Client Email", etc.).');
          return res.redirect('/admin/clients/upload');
        }
        
        // Process the Excel file
        clients = await processClientExcel(filePath, clientIdField);
      } else if (fileExtension === '.csv') {
        // Use existing CSV processing
        // This code would be from the previous CSV processing implementation
        // ... existing CSV processing code ...
      } else {
        // Unsupported file type
        fs.unlinkSync(filePath);
        req.flash('error', 'Unsupported file format. Please upload a CSV or Excel (.xlsx) file.');
        return res.redirect('/admin/clients/upload');
      }
      
      // Delete the uploaded file
      fs.unlinkSync(filePath);
      
      // Check if any clients were found
      if (clients.length === 0) {
        req.flash('error', 'No valid client records found in the file');
        return res.redirect('/admin/clients/upload');
      }
      
      // Insert or update the clients in the database
      const results = await Client.bulkUpsert(clients);
      
      // Set success message
      req.flash('success', `Successfully imported ${results.length} clients. ` +
        `${results.filter(r => r.action === 'created').length} created, ` +
        `${results.filter(r => r.action === 'updated').length} updated.`);
      
      res.redirect('/admin/clients');
    } catch (error) {
      logger.error('File upload error:', error);
      
      // Delete the uploaded file if it exists
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting uploaded file:', unlinkError);
        }
      }
      
      req.flash('error', `Failed to process file: ${error.message}`);
      res.redirect('/admin/clients/upload');
    }
  });
};

// Delete a client
exports.deleteClient = async (req, res) => {
  try {
    const clientId = req.params.id;
    
    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }
    
    // Delete the client
    await Client.delete(clientId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Client deleted successfully' 
    });
  } catch (error) {
    logger.error('Error deleting client:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to delete client. Please try again.' 
    });
  }
}; 