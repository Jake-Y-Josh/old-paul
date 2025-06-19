-- Add last_login column to admins table
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;