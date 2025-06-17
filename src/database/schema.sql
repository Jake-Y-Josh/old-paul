-- Schema for Feedback System

-- Create admins table if it doesn't exist
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create clients table if it doesn't exist
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  extra_data JSONB, -- for any additional client-specific fields
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create forms table if it doesn't exist
CREATE TABLE IF NOT EXISTS forms (
  id SERIAL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  questions JSONB NOT NULL, -- JSON array defining the form fields
  created_by INTEGER REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create form_submissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS form_submissions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  form_id INTEGER REFERENCES forms(id),
  responses JSONB, -- the client responses stored as JSON
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create email_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  form_id INTEGER REFERENCES forms(id),
  to_email VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message_id VARCHAR(255),
  status VARCHAR(50) NOT NULL, -- e.g., 'sent', 'failed'
  type VARCHAR(50), -- e.g., 'feedback_request', 'reminder'
  error TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activities table if it doesn't exist
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES admins(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- e.g., 'form', 'client', 'email'
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes if they don't exist
DO $$
BEGIN
    -- Add an index on client email for faster lookups
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clients_email'
    ) THEN
        CREATE INDEX idx_clients_email ON clients(email);
    END IF;

    -- Add an index on form_submission timestamps for reporting
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_submissions_timestamp'
    ) THEN
        CREATE INDEX idx_submissions_timestamp ON form_submissions(submitted_at);
    END IF;

    -- Add an index on admin reset token for faster lookups
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_reset_token'
    ) THEN
        CREATE INDEX idx_admin_reset_token ON admins(reset_token);
    END IF;
END $$;

-- Check if admin user exists, if not add it (password: admin123)
INSERT INTO admins (username, email, password_hash)
SELECT 'admin', 'admin@example.com', '$2b$10$rMYQMgw3LHmKWJgMYdM5qem/mKv91OjsKtODws.JJx7FP0HiXvXI6'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'admin');

-- Create the update_modified_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers if they don't exist
DO $$
BEGIN
    -- Create trigger for forms table
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_form_modtime'
    ) THEN
        CREATE TRIGGER update_form_modtime
        BEFORE UPDATE ON forms
        FOR EACH ROW
        EXECUTE PROCEDURE update_modified_column();
    END IF;

    -- Create trigger for clients table
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_client_modtime'
    ) THEN
        CREATE TRIGGER update_client_modtime
        BEFORE UPDATE ON clients
        FOR EACH ROW
        EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$; 