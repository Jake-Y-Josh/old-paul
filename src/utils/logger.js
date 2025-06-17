/**
 * Simple logger utility
 */

const logger = {
  info: function(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  },
  
  error: function(message, ...args) {
    console.error(`[ERROR] ${message}`, ...args);
  },
  
  warn: function(message, ...args) {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  debug: function(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
};

module.exports = logger; 