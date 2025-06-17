const fs = require('fs');
const { parse } = require('csv-parse');

/**
 * Process a CSV file with client data
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array>} - Array of client objects
 */
const processClientCsv = (filePath) => {
  return new Promise((resolve, reject) => {
    const clients = [];
    
    // Create a readable stream
    const stream = fs.createReadStream(filePath);
    
    // CSV parser options
    const parserOptions = {
      columns: true, // Automatically use the first line as header
      skip_empty_lines: true,
      trim: true
    };
    
    // Parse the CSV file
    stream
      .pipe(parse(parserOptions))
      .on('data', (row) => {
        // Validate required fields
        if (!row.name || !row.email) {
          return; // Skip invalid rows
        }
        
        // Process row data into a client object
        const client = {
          name: row.name,
          email: row.email.toLowerCase(),
          extraData: {}
        };
        
        // Add any additional columns as extra data
        Object.keys(row).forEach(key => {
          if (key !== 'name' && key !== 'email') {
            client.extraData[key] = row[key];
          }
        });
        
        clients.push(client);
      })
      .on('end', () => {
        resolve(clients);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

/**
 * Validates a CSV file format to ensure it has the required columns
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<boolean>} - True if valid, false otherwise
 */
const validateCsvFormat = (filePath) => {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    
    stream
      .pipe(parse({ columns: true, to: 1 })) // Read only the header row
      .on('data', (row) => {
        const headers = Object.keys(row);
        // Check if required columns exist
        if (!headers.includes('name') || !headers.includes('email')) {
          resolve(false);
        } else {
          resolve(true);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

module.exports = {
  processClientCsv,
  validateCsvFormat
}; 