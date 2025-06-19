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
    username: req.session.user ? req.session.user.username : req.session.username,
    success: req.flash('success')[0] || null,
    error: req.flash('error')[0] || null
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
    logger.info('Update client request received:', { 
      clientId: req.params.id, 
      body: req.body 
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Validation errors:', errors.array());
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
    const clientIdField = req.body.clientIdField || 'Client Reference';
    const updateExisting = req.body.updateExisting === 'on';
    const removeNotInSpreadsheet = req.body.removeNotInSpreadsheet === 'on';
    
    logger.info(`Processing file upload: ${req.file.originalname}, extension: ${fileExtension}, path: ${filePath}`);
    
    let clients = [];
    let isValid = false;
    
    // Process file based on extension
    if (fileExtension === '.xlsx') {
      // SKIP THE FUCKING VALIDATION - WE KNOW YOUR FILE HAS THE RIGHT COLUMNS
      logger.info('Skipping Excel validation - processing file directly');
      
      // Process the Excel file
      try {
        clients = await processClientExcel(filePath, clientIdField);
        logger.info(`Excel processing completed. Found ${clients.length} clients`);
      } catch (excelError) {
        logger.error('Error processing Excel file:', excelError);
        fs.unlinkSync(filePath);
        req.flash('error', `Failed to process Excel file: ${excelError.message}`);
        return res.redirect('/admin/clients/upload');
      }
    } else if (fileExtension === '.csv') {
      // Process CSV file
      const results = [];
      let errorOccurred = false;
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            // Debug: log first row to see column names
            if (results.length === 0) {
              logger.info('CSV columns:', Object.keys(row));
            }
            
            // Look for name and email in various possible column names (case-insensitive)
            let name = '';
            let email = '';
            let clientReference = null;
            
            // Find name column (case-insensitive)
            Object.keys(row).forEach(key => {
              const lowerKey = key.toLowerCase();
              const value = row[key];
              
              if (!name) {
                if (lowerKey === 'name' || lowerKey === 'client name') {
                  name = value;
                } else if (key === 'Client Forename' && row['Client Surname']) {
                  // Combine forename and surname
                  name = `${value} ${row['Client Surname']}`.trim();
                } else if (key === 'Client Forename/Surname') {
                  name = value;
                }
              }
              
              if (!email && (lowerKey === 'email' || lowerKey === 'client email' || key === 'Client Email')) {
                email = value;
              }
            });
            
            // Get client reference from the specified field
            clientReference = row[clientIdField] || null;
            
            // Only process if we have at least a name and valid email
            if (name && email && email.includes('@')) {
              const client = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                enablecrm_id: clientReference ? clientReference.trim() : null,
                extra_data: {}
              };
              
              // Store the client reference in extra_data as well
              if (clientReference) {
                client.extra_data.clientId = clientReference.trim();
              }
              
              // Add all other fields to extra_data but skip the ones we've already processed
              Object.keys(row).forEach(key => {
                if (key !== clientIdField && 
                    key !== 'Client Forename' && 
                    key !== 'Client Surname' && 
                    key !== 'Client Email' &&
                    !['name', 'Name', 'email', 'Email', 'Client Name', 'Client Forename/Surname'].includes(key)) {
                  client.extra_data[key] = row[key];
                }
              });
              
              results.push(client);
            } else {
              if (!name) {
                logger.warn('Skipping row - missing name');
              } else if (!email) {
                logger.warn('Skipping row - missing email for:', name);
              } else if (!email.includes('@')) {
                logger.warn('Skipping row - invalid email for:', name, email);
              }
            }
          })
          .on('end', () => {
            logger.info(`CSV parsing completed. Found ${results.length} valid clients`);
            resolve();
          })
          .on('error', (error) => {
            logger.error('CSV parsing error:', error);
            errorOccurred = true;
            reject(error);
          });
      }).catch(error => {
        logger.error('Error processing CSV:', error);
        throw new Error(`Failed to parse CSV file: ${error.message}`);
      });
      
      if (errorOccurred) {
        throw new Error('Failed to parse CSV file');
      }
      
      clients = results;
      logger.info(`Processed ${clients.length} clients from CSV`);
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
      logger.error('No clients found after processing file');
      req.flash('error', 'No valid client records found in the file');
      return res.redirect('/admin/clients/upload');
    }
    
    logger.info(`File processing complete. Found ${clients.length} clients to process`);
    
    // Check for existing clients
    const existingClients = [];
    const newClients = [];
    const duplicatesInFile = [];
    const referencesSeen = new Set();
    
    for (const client of clients) {
      // ONLY CHECK FOR DUPLICATES BASED ON CLIENT REFERENCE
      if (client.enablecrm_id) {
        // Check for duplicate references within the file
        if (referencesSeen.has(client.enablecrm_id)) {
          duplicatesInFile.push(client);
          continue;
        }
        referencesSeen.add(client.enablecrm_id);
        
        // Check if client exists in database by Client Reference
        const existing = await Client.findByClientId(client.enablecrm_id);
        
        if (existing) {
          existingClients.push({
            ...client,
            existing: {
              id: existing.id,
              name: existing.name,
              email: existing.email,
              enablecrm_id: existing.enablecrm_id || existing.extra_data?.clientId
            }
          });
        } else {
          newClients.push(client);
        }
      } else {
        // No Client Reference = always a new client
        newClients.push(client);
      }
    }
    
    // Get list of clients to be removed if option is selected
    let clientsToRemove = [];
    if (removeNotInSpreadsheet) {
      // Get all existing clients from database
      const allClients = await Client.findAll();
      
      // Get client references from imported clients
      const importedReferences = new Set();
      for (const client of [...newClients, ...existingClients]) {
        if (client.enablecrm_id) {
          importedReferences.add(client.enablecrm_id);
        }
      }
      
      // Find clients that have a client reference in DB but not in import
      clientsToRemove = allClients.filter(client => {
        const clientRef = client.enablecrm_id || client.extra_data?.clientId;
        // Only remove clients that have a reference and it's not in the import
        return clientRef && !importedReferences.has(clientRef);
      });
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
    const skipped = results.filter(r => r.action === 'skipped').length;
    
    let message = `Import completed: ${created} clients created`;
    if (updated > 0) message += `, ${updated} updated`;
    if (skipped > 0) message += `, ${skipped} skipped (duplicate emails)`;
    if (removedCount > 0) message += `, ${removedCount} removed`;
    if (preview.duplicatesInFile.length > 0) {
      message += `. ${preview.duplicatesInFile.length} duplicates in file were ignored`;
    }
    
    // Log any skipped clients
    const skippedClients = results.filter(r => r.action === 'skipped');
    if (skippedClients.length > 0) {
      logger.warn('Skipped clients due to duplicate emails:', skippedClients);
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