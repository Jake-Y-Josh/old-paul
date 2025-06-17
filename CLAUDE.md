# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Client Feedback Management System - a web application for collecting and managing client feedback with admin and client interfaces. The system enables administrators to create custom feedback forms, manage client data, send emails requesting feedback, and view submitted responses.

## Development Commands

```bash
# Install dependencies
npm install

# Start the application in production mode
npm start

# Start the application in development mode with auto-reload
npm run dev

# Database initialization (run once when setting up)
node init-db.js 

# Run database checks
node test-db.js

# Check database connection
node check-db.js
```

## Environment Setup

The application requires a PostgreSQL database and environment variables configured in a `.env` file:

```
# Application Settings
PORT=3000
NODE_ENV=development

# Database Connection
DATABASE_URL=postgres://username:password@localhost:5432/yourdb

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

## Architecture

### Application Structure

- **Entry Point**: `index.js` loads environment variables and imports the Express app from `src/app.js`
- **Express App**: `src/app.js` configures middleware, sets up routes, and initializes the database
- **Database**: PostgreSQL with connection managed in `src/database/db.js`
- **Models**: Located in `src/models/`, handle database interactions for different entities
- **Controllers**: Located in `src/controllers/`, contain business logic
- **Routes**: Located in `src/routes/`, define API endpoints
- **Views**: EJS templates in `src/views/` for rendering HTML

### Database Schema

The application uses PostgreSQL with the following tables:
- `admins`: Administrator account data
- `clients`: Client information 
- `forms`: Form structure with JSON-stored questions
- `form_submissions`: Client responses to forms
- `email_logs`: Email tracking information
- `activities`: Audit log of admin actions
- `settings`: Application configuration settings

### Authentication

The application uses session-based authentication for administrators with middleware in `src/middlewares/auth.js`.

### Email System

The application sends feedback request emails to clients and can track email opens and clicks through webhooks.

## Deployment

The repository includes Vercel configuration for serverless deployment in `vercel.json`.

## Key Files to Understand

- `src/app.js`: Main application setup
- `src/database/db.js`: Database connection and initialization
- `src/database/schema.sql`: Database schema definition
- `src/models/`: Entity models (client.js, form.js, submission.js, etc.)
- `src/controllers/`: Business logic (formController.js, emailController.js, etc.)
- `src/utils/mailer.js`: Email sending functionality