const Client = require('../../models/client');
const Form = require('../../models/form');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const logger = require('../../utils/logger');
const { processClientExcel, validateExcelFormat } = require('../../utils/excelProcessor');

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
    username: req.session.user ? req.session.user.username : req.session.username
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
  try {
    if (!req.file) {
      req.flash('error', 'Please select a file to upload');
      return res.redirect('/admin/clients/upload');
    }
    
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const clientIdField = req.body.clientIdField || 'Client ID';
    const updateExisting = req.body.updateExisting === 'on';
    const removeNotInSpreadsheet = req.body.removeNotInSpreadsheet === 'on';
    
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
      // Process CSV file
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            // Look for name and email in various possible column names
            const name = row.name || row.Name || row['Client Name'] || row['Client Forename/Surname'] || '';
            const email = row.email || row.Email || row['Client Email'] || '';
            const clientId = row[clientIdField] || row.id || row.ID || null;
            
            if (name && email) {
              const client = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                enablecrm_id: clientId ? clientId.trim() : null,
                extra_data: {}
              };
              
              // Add all other fields to extra_data
              Object.keys(row).forEach(key => {
                if (!['name', 'Name', 'email', 'Email', 'Client Name', 'Client Email', 'Client Forename/Surname', clientIdField].includes(key)) {
                  client.extra_data[key] = row[key];
                }
              });
              
              results.push(client);
            }
          })
          .on('end', () => resolve())
          .on('error', reject);
      });
      clients = results;
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
    
    // Check for existing clients
    const existingClients = [];
    const newClients = [];
    const duplicatesInFile = [];
    const emailsSeen = new Set();
    
    for (const client of clients) {
      // Check for duplicates within the file
      if (emailsSeen.has(client.email)) {
        duplicatesInFile.push(client);
        continue;
      }
      emailsSeen.add(client.email);
      
      // Check if client exists in database
      const existing = await Client.findByEmail(client.email);
      if (existing) {
        existingClients.push({
          ...client,
          existing: {
            id: existing.id,
            name: existing.name,
            email: existing.email,
            enablecrm_id: existing.enablecrm_id
          }
        });
      } else {
        newClients.push(client);
      }
    }
    
    // Get list of clients to be removed if option is selected
    let clientsToRemove = [];
    if (removeNotInSpreadsheet) {
      // Get all existing clients from database
      const allClients = await Client.findAll();
      
      // Get emails from imported clients
      const importedEmails = new Set([
        ...newClients.map(c => c.email.toLowerCase()),
        ...existingClients.map(c => c.email.toLowerCase())
      ]);
      
      // Find clients that exist in DB but not in import
      clientsToRemove = allClients.filter(client => 
        !importedEmails.has(client.email.toLowerCase())
      );
    }
    
    // Store the parsed data in session for preview
    req.session.importPreview = {
      newClients,
      existingClients,
      duplicatesInFile,
      updateExisting,
      removeNotInSpreadsheet,
      clientsToRemove,
      totalCount: clients.length
    };
    
    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        logger.error('Error saving session:', err);
        req.flash('error', 'Failed to save import data. Please try again.');
        return res.redirect('/admin/clients/upload');
      }
      
      // Redirect to preview page
      res.redirect('/admin/clients/import-preview');
    });
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
};

// Show import preview
exports.showImportPreview = async (req, res) => {
  try {
    const preview = req.session.importPreview;
    
    if (!preview) {
      req.flash('error', 'No import data found. Please upload a file first.');
      return res.redirect('/admin/clients/upload');
    }
    
    res.render('admin/clients/import-preview', {
      title: 'Import Preview',
      username: req.session.user ? req.session.user.username : req.session.username,
      preview,
      layout: 'layouts/admin',
      success: req.flash('success')[0] || null,
      error: req.flash('error')[0] || null
    });
  } catch (error) {
    logger.error('Error showing import preview:', error);
    req.flash('error', 'Failed to display import preview');
    res.redirect('/admin/clients/upload');
  }
};

// Confirm and process the import
exports.confirmImport = async (req, res) => {
  try {
    const preview = req.session.importPreview;
    
    if (!preview) {
      req.flash('error', 'No import data found. Please upload a file first.');
      return res.redirect('/admin/clients/upload');
    }
    
    const { action } = req.body;
    
    if (action === 'cancel') {
      // Clear the preview data
      delete req.session.importPreview;
      req.flash('info', 'Import cancelled');
      return res.redirect('/admin/clients/upload');
    }
    
    // Process the import
    const clientsToImport = [...preview.newClients];
    
    // Add existing clients if update flag is set
    if (preview.updateExisting) {
      clientsToImport.push(...preview.existingClients);
    }
    
    // Insert or update the clients in the database
    const results = await Client.bulkUpsert(clientsToImport);
    
    // Remove clients not in spreadsheet if option was selected
    let removedCount = 0;
    if (preview.removeNotInSpreadsheet && preview.clientsToRemove && preview.clientsToRemove.length > 0) {
      for (const client of preview.clientsToRemove) {
        try {
          await Client.delete(client.id);
          removedCount++;
        } catch (error) {
          logger.error(`Failed to remove client ${client.id}:`, error);
        }
      }
    }
    
    // Clear the preview data
    delete req.session.importPreview;
    
    // Set success message
    const created = results.filter(r => r.action === 'created').length;
    const updated = results.filter(r => r.action === 'updated').length;
    const skipped = preview.existingClients.length - updated;
    
    let message = `Import completed: ${created} clients created`;
    if (updated > 0) message += `, ${updated} updated`;
    if (skipped > 0 && !preview.updateExisting) message += `, ${skipped} skipped (already exist)`;
    if (removedCount > 0) message += `, ${removedCount} removed`;
    if (preview.duplicatesInFile.length > 0) {
      message += `. ${preview.duplicatesInFile.length} duplicates in file were ignored`;
    }
    
    req.flash('success', message);
    res.redirect('/admin/clients');
  } catch (error) {
    logger.error('Error confirming import:', error);
    req.flash('error', `Import failed: ${error.message}`);
    res.redirect('/admin/clients/import-preview');
  }
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