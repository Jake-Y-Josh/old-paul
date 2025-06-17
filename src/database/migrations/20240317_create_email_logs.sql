-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    form_id INTEGER REFERENCES forms(id) ON DELETE SET NULL,
    to_email VARCHAR(255) NOT NULL,
    subject TEXT,
    message_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    type VARCHAR(50) DEFAULT 'other',
    error TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    opened BOOLEAN DEFAULT FALSE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 

-- Update any empty recipients
UPDATE email_logs SET to_email = (
    SELECT c.email 
    FROM clients c 
    WHERE c.id = email_logs.client_id
) 
WHERE to_email = '';

-- Ensure to_email is never empty going forward
ALTER TABLE email_logs ADD CONSTRAINT email_logs_to_email_not_empty CHECK (to_email != ''); 