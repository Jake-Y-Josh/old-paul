const Client = require('../models/client');
const { processClientCsv, validateCsvFormat } = require('../utils/csvProcessor');
const { processClientExcel, validateExcelFormat } = require('../utils/excelProcessor');
const path = require('path');
const fs = require('fs');

/**
 * Client Controller
 */

// List all clients
const listClients = async (req, res) => {
  try {
    const clients = await Client.getAll();
    
    // Get all forms for the send survey modal
    const Form = require('../models/form');
    const forms = await Form.getAll();
    
    res.render('admin/clients/list', {
      title: 'Client Management',
      clients,
      forms, // Pass forms to the template
      success: req.query.success,
      error: req.query.error,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error listing clients:', error);
    res.render('error', { 
      message: 'Failed to load client list',
      error,
      layout: false
    });
  }
};

// Render file upload page
const csvUploadPage = (req, res) => {
  res.render('admin/clients/upload', {
    title: 'Import Clients',
    username: req.session.username,
    layout: 'layouts/admin'
  });
};

// Process file upload (CSV or Excel)
const uploadCsv = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const clientIdField = req.body.clientIdField || 'Client ID';
    let clients = [];
    let isValid = false;
    
    // Process file based on extension
    if (fileExtension === '.xlsx') {
      // Validate Excel format
      isValid = await validateExcelFormat(filePath);
      
      if (!isValid) {
        // Delete the uploaded file
        fs.unlinkSync(filePath);
        
        return res.status(400).json({
          success: false,
          message: 'Invalid Excel format. File must include name and email columns (e.g., "name", "Client Forename/Surname", "email", "Client Email", etc.).'
        });
      }
      
      // Process the Excel file
      clients = await processClientExcel(filePath, clientIdField);
    } else if (fileExtension === '.csv') {
      // Validate CSV format
      isValid = await validateCsvFormat(filePath);
      
      if (!isValid) {
        // Delete the uploaded file
        fs.unlinkSync(filePath);
        
        return res.status(400).json({
          success: false,
          message: 'Invalid CSV format. File must include "name" and "email" columns.'
        });
      }
      
      // Process the CSV file
      clients = await processClientCsv(filePath);
    } else {
      // Delete the uploaded file
      fs.unlinkSync(filePath);
      
      return res.status(400).json({
        success: false,
        message: 'Unsupported file format. Please upload a CSV or Excel (.xlsx) file.'
      });
    }
    
    // Delete the uploaded file
    fs.unlinkSync(filePath);
    
    // Check if any clients were found
    if (clients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid client records found in the file'
      });
    }
    
    // Insert the clients into the database
    const results = await Client.bulkUpsert(clients);
    
    res.status(200).json({
      success: true,
      message: `Successfully imported ${results.length} clients. ${results.filter(r => r.action === 'created').length} created, ${results.filter(r => r.action === 'updated').length} updated.`,
      clientCount: results.length
    });
  } catch (error) {
    console.error('File upload error:', error);
    
    // Delete the uploaded file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to process file',
      error: error.message
    });
  }
};

// Create a single client
const createClient = async (req, res) => {
  try {
    const { name, email, extraData } = req.body;
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }
    
    // Check if client with this email already exists
    const existingClient = await Client.getByEmail(email);
    
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
    
    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      client
    });
  } catch (error) {
    console.error('Client creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create client',
      error: error.message
    });
  }
};

// Delete a client
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if client exists
    const existingClient = await Client.getById(id);
    
    if (!existingClient) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Delete the client
    await Client.delete(id);
    
    res.status(200).json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Client deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete client',
      error: error.message
    });
  }
};

module.exports = {
  listClients,
  csvUploadPage,
  uploadCsv,
  createClient,
  deleteClient
}; 