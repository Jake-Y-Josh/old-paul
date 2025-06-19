const fs = require('fs');
const XLSX = require('xlsx');
const logger = require('./logger');

/**
 * Process an Excel file with client data
 * @param {string} filePath - Path to the Excel file
 * @param {string} clientIdField - The name of the column that contains the client ID
 * @returns {Promise<Array>} - Array of client objects
 */
const processClientExcel = (filePath, clientIdField = 'Client Reference') => {
  return new Promise((resolve, reject) => {
    try {
      // Read the Excel file
      logger.info(`Reading Excel file: ${filePath}`);
      const workbook = XLSX.readFile(filePath);
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return reject(new Error('Excel file has no sheets'));
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON - this will use the first row as headers
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      logger.info(`Found ${jsonData.length} rows in Excel file`);
      
      if (jsonData.length === 0) {
        return resolve([]);
      }
      
      // Log the first row to see column names
      logger.info('First row columns:', Object.keys(jsonData[0]));
      
      const clients = [];
      
      for (const row of jsonData) {
        // Get name by combining Client Forename and Client Surname
        const forename = row['Client Forename'] || '';
        const surname = row['Client Surname'] || '';
        const name = `${forename} ${surname}`.trim();
        
        // Get email from Client Email column
        const email = row['Client Email'] || '';
        
        // Get client reference
        const clientReference = row[clientIdField] || '';
        
        // Skip if no name or email
        if (!name || !email) {
          logger.warn(`Skipping row - missing name or email. Name: "${name}", Email: "${email}"`);
          continue;
        }
        
        // Skip if email is invalid
        if (!email.includes('@')) {
          logger.warn(`Skipping row - invalid email: "${email}" for ${name}`);
          continue;
        }
        
        // Create client object
        const client = {
          name: name,
          email: email.toLowerCase().trim(),
          enablecrm_id: clientReference ? clientReference.toString().trim() : null,
          extra_data: {}
        };
        
        // Store client reference in extra_data too
        if (clientReference) {
          client.extra_data.clientId = clientReference.toString().trim();
        }
        
        // Add all other columns to extra_data
        Object.keys(row).forEach(key => {
          if (key !== 'Client Forename' && 
              key !== 'Client Surname' && 
              key !== 'Client Email' && 
              key !== clientIdField) {
            client.extra_data[key] = row[key];
          }
        });
        
        clients.push(client);
      }
      
      logger.info(`Successfully processed ${clients.length} clients from Excel`);
      if (clients.length > 0) {
        logger.info('Example client:', clients[0]);
      }
      
      resolve(clients);
    } catch (error) {
      logger.error('Error processing Excel file:', error);
      reject(error);
    }
  });
};

/**
 * Validates an Excel file format to ensure it has the required columns
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<boolean>} - True if valid, false otherwise
 */
const validateExcelFormat = (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      // Read the Excel file with error handling
      let workbook;
      try {
        workbook = XLSX.readFile(filePath);
      } catch (readError) {
        logger.error('Failed to read Excel file for validation:', readError);
        return resolve(false); // Invalid format
      }
      
      // Check if workbook has sheets
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return resolve(false);
      }
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        return resolve(false);
      }
      
      // Convert first row to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (!jsonData || jsonData.length === 0) {
        return resolve(false);
      }
      
      // Get headers from the first row
      const headers = jsonData[0];
      
      // The problem is the headers might be in a different format
      // Let's properly check for the columns we need
      let hasName = false;
      let hasEmail = false;
      
      // Check if headers is an array (from header: 1 option)
      if (Array.isArray(headers)) {
        // Look for the exact column names
        hasName = headers.includes('Client Forename') || headers.includes('Client Surname');
        hasEmail = headers.includes('Client Email');
        
        logger.info('Checking array headers - hasName:', hasName, 'hasEmail:', hasEmail);
      } else {
        logger.error('Headers is not an array:', typeof headers);
      }
      
      // Log the headers for debugging
      logger.info('Excel validation - Total headers:', headers.length);
      logger.info('Excel validation - First 10 headers:', headers.slice(0, 10));
      logger.info('Excel validation - Has name column:', hasName);
      logger.info('Excel validation - Has email column:', hasEmail);
      
      // For debugging, let's check specific headers
      const hasClientForename = headers.includes('Client Forename');
      const hasClientSurname = headers.includes('Client Surname');
      const hasClientEmail = headers.includes('Client Email');
      
      logger.info('Has "Client Forename":', hasClientForename);
      logger.info('Has "Client Surname":', hasClientSurname);
      logger.info('Has "Client Email":', hasClientEmail);
      
      resolve(hasName && hasEmail);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  processClientExcel,
  validateExcelFormat
}; 