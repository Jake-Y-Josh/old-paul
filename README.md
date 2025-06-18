# Client Feedback Management System

A web application for managing client feedback with admin and client interfaces.

## Overview

This application provides a comprehensive system for managing client feedback:

### Admin Interface
- Secure admin authentication
- Feedback form creation and management
- Client data management (CSV import)
- Email dispatch for feedback requests

### Client Interface
- Dynamic, personalized feedback forms
- Simple submission process

## Technology Stack

- Database: PostgreSQL
- Backend: Node.js
- Email: Nodemailer
- Security: bcrypt for password hashing

## Setup Instructions

1. Clone the repository
2. Create a Supabase project (if you haven't already) and obtain your database connection string
3. Configure environment variables in a `.env` file:
   ```
   # Application Settings
   PORT=3000
   NODE_ENV=development

   # Supabase Database Connection
   # Provide either a full connection string:
   DATABASE_URL=postgres://username:password@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require
   # or individual settings:
   # DB_HOST=your_db_host
   # DB_USER=your_db_user
   # DB_PASSWORD=your_db_password
   # DB_NAME=your_db_name
   # DB_PORT=your_db_port
  # DB_SSL=true

  # Supabase API (if using the Supabase client)
  SUPABASE_URL=https://your-project.supabase.co
  # Provide either SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_KEY=your_supabase_service_role_key

   # Security
   SESSION_SECRET=your_super_secret_session_key

   # SMTP Settings for Email
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your_smtp_username
   SMTP_PASS=your_smtp_password
   SMTP_SECURE=false

   # Email Configuration
   EMAIL_FROM=feedback@dynamic-fp.co.uk
   EMAIL_FROM_NAME=Dynamic FP Feedback
   EMAIL_REPLY_TO=enquiries@dynamic-fp.co.uk
   ```
4. Install dependencies: `npm install`
5. Run the database setup scripts
6. Start the application: `npm start`

## Development Order

1. Database and Schema Setup
2. Admin Interface
   - Authentication & Session Management
   - Feedback Form Creation/Editing
   - Client Management & CSV Upload
   - Client Selection & Form Dispatch
3. Client-Facing Feedback Form
4. Email Integration
5. Deployment

## Database Schema

The application uses the following database tables:

- `admins`: Administrator account data
- `clients`: Client information 
- `feedback_forms`: Form structure and content
- `feedback_submissions`: Client responses
- `email_logs`: Email tracking information (optional) 

# Email Tracking Setup

For email tracking to work properly (to show when emails are opened or clicked), you need to set up a webhook with your email provider (Resend).

## Setting Up Resend Webhook

1. **Login to Resend Dashboard**: Go to [Resend Dashboard](https://resend.com/dashboard) and login to your account.

2. **Create a Webhook**: 
   - Navigate to the Webhooks section
   - Click "Add Webhook"
   - Enter your webhook URL: `https://your-app-domain.com/admin/emails/webhook`
   - Select events to track: `email.delivered`, `email.opened`, and `email.clicked`
   - Save the webhook

3. **Verify Webhook Setup**:
   - Send a test email
   - Open the test email
   - Check your email logs - you should see the "Opened" status change

If email tracking still shows "Not Read" for all emails, check these common issues:

- Ensure your Resend API key is valid and has the necessary permissions
- Check if the webhook URL is publicly accessible
- Verify that the webhook endpoint (`/admin/emails/webhook`) is correctly configured in your application
- Check server logs for any webhook processing errors

## Testing Webhooks Locally

For testing webhooks during development:
1. Use a service like [ngrok](https://ngrok.com/) to expose your local server
2. Run `ngrok http 3005` (use your app's port)
3. Set the webhook URL in Resend to the ngrok URL (e.g., `https://123abc.ngrok.io/admin/emails/webhook`) 