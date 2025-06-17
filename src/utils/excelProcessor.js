const fs = require('fs');
const XLSX = require('xlsx');
const logger = require('./logger');

/**
 * Process an Excel file with client data
 * @param {string} filePath - Path to the Excel file
 * @param {string} clientIdField - The name of the column that contains the client ID
 * @returns {Promise<Array>} - Array of client objects
 */
const processClientExcel = (filePath, clientIdField = 'Client ID') => {
  return new Promise((resolve, reject) => {
    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // Check if there's any data
      if (!jsonData || jsonData.length === 0) {
        return resolve([]);
      }
      
      // Process rows into client objects
      const clients = [];
      const processedClientIds = new Set();
      
      for (const row of jsonData) {
        let name = '';
        let email = '';
        
        // Extract name from various possible fields
        if (row.name || row.Name || row.NAME) {
          name = row.name || row.Name || row.NAME;
        } else if (row['Client Forename'] && row['Client Surname']) {
          // Combine forename and surname
          name = `${row['Client Forename']} ${row['Client Surname']}`;
        } else {
          // Look for any field that might contain the name
          const forenameField = Object.keys(row).find(key => 
            key.toLowerCase().includes('forename')
          );
          
          const surnameField = Object.keys(row).find(key => 
            key.toLowerCase().includes('surname')
          );
          
          if (forenameField && surnameField) {
            name = `${row[forenameField]} ${row[surnameField]}`;
          } else {
            const nameField = Object.keys(row).find(key => 
              key.toLowerCase().includes('name') && !key.toLowerCase().includes('email')
            );
            
            if (nameField) {
              name = row[nameField];
            } else {
              logger.warn('Missing name in row:', row);
              continue;
            }
          }
        }
        
        // Extract email from various possible fields
        if (row.email || row.Email || row.EMAIL) {
          email = (row.email || row.Email || row.EMAIL || '').toLowerCase();
        } else if (row['Client Email']) {
          email = row['Client Email'].toLowerCase();
        } else {
          // Look for any field that might contain the email
          const emailField = Object.keys(row).find(key => 
            key.toLowerCase().includes('email')
          );
          
          if (emailField) {
            email = row[emailField].toLowerCase();
          } else {
            logger.warn('Missing email in row:', row);
            continue;
          }
        }
        
        // If email is not valid, skip this row
        if (!email || !email.includes('@')) {
          logger.warn('Invalid email in row:', row);
          continue;
        }
        
        // Get client ID
        let clientId = null;
        if (clientIdField && clientIdField.trim() !== '') {
          clientId = row[clientIdField] || row[clientIdField.toLowerCase()] || row[clientIdField.toUpperCase()];
        }
        
        // Skip if this client ID has already been processed in this import
        if (clientId && processedClientIds.has(clientId.toString())) {
          logger.info(`Skipping duplicate client ID within import: ${clientId}`);
          continue;
        }
        
        // Process row data into a client object
        const client = {
          name: name.trim(),
          email: email.trim(),
          extraData: {}
        };
        
        // Store client ID in extraData if present
        if (clientId) {
          client.extraData.clientId = clientId.toString();
          processedClientIds.add(clientId.toString());
        }
        
        // Add any additional columns as extra data
        Object.keys(row).forEach(key => {
          // Skip the fields we've already processed directly
          if (key !== 'name' && key !== 'Name' && key !== 'NAME') {
            client.extraData[key] = row[key];
          }
        });
        
        clients.push(client);
      }
      
      logger.info(`Processed ${clients.length} clients from Excel file`);
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
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert first row to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (!jsonData || jsonData.length === 0) {
        return resolve(false);
      }
      
      // Get headers from the first row
      const headers = jsonData[0];
      
      // Check if required columns exist (looking for various name and email formats)
      const hasName = headers.some(header => 
        typeof header === 'string' && 
        (
          header.toLowerCase() === 'name' || 
          header.toLowerCase() === 'client forename' ||
          header.toLowerCase() === 'client surname' ||
          header.toLowerCase().includes('name') ||
          header.toLowerCase().includes('forename') ||
          header.toLowerCase().includes('surname')
        )
      );
      
      const hasEmail = headers.some(header => 
        typeof header === 'string' && 
        (
          header.toLowerCase() === 'email' || 
          header.toLowerCase() === 'client email' ||
          header.toLowerCase().includes('email')
        )
      );
      
      // Log the headers for debugging
      logger.info('Excel headers found:', headers);
      logger.info('Has name column:', hasName);
      logger.info('Has email column:', hasEmail);
      
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