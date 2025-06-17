# Dynamic FP Feedback System - Technical Audit Documentation

## Application Architecture

### Overview
The Dynamic FP Feedback System is a web application built using Node.js and Express.js with PostgreSQL database storage. The application provides a secure platform for financial advisers to gather and manage client feedback.

### Technology Stack
- **Backend**: Node.js v16+ with Express.js framework
- **Database**: PostgreSQL on Supabase
- **Frontend**: Server-side rendered EJS templates with Bootstrap 5
- **Authentication**: Session-based authentication with encrypted cookies
- **Email**: Secure SMTP via nodemailer using TLS

## Data Flow & Security

### Client Data Handling
1. **Collection**: Client information is collected via secure forms or CSV/Excel imports
2. **Storage**: All client data is stored in the PostgreSQL database with SSL-encrypted connections
3. **Access**: Client data is only accessible to authenticated administrators
4. **Transmission**: Data is transmitted between client and server using HTTPS/TLS encryption

### Authentication Flow
1. Users authenticate via username/password
2. Passwords are verified against bcrypt-hashed values stored in the database
3. Successful authentication creates a secure session
4. Session information is stored in encrypted, HTTP-only cookies
5. All authenticated routes are protected by middleware that verifies session validity

### Email Communication
1. Emails are sent via SMTP with TLS encryption
2. Email sending is logged for audit purposes
3. No sensitive client information is included in email content beyond what is necessary

## Security Implementation Details

### Database Security
```javascript
// Database connection via Supabase connection string
if (!process.env.DATABASE_URL) {
  console.error('Environment variable DATABASE_URL is not set. Please configure your Supabase connection string.');
  process.exit(1);
}
const sslConfig = { rejectUnauthorized: false }; // Allow self-signed certificates
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});

// Example of parameterized query to prevent SQL injection
const getClientById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM clients WHERE id = $1',
    [id] // Parameters are passed separately to prevent SQL injection
  );
  return result.rows[0];
};
```

### Authentication Security
```javascript
// Password hashing with bcrypt
const createUser = async (username, email, password) => {
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  const result = await db.query(
    'INSERT INTO admins (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [username, email, passwordHash]
  );
  return result.rows[0];
};

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Always use secure cookies
    httpOnly: true, // Protect against XSS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return next();
  }
  res.redirect('/admin/login');
};
```

### Activity Logging
```javascript
// Log admin activity for audit trail
const logActivity = async (adminId, action, details, ipAddress) => {
  await db.query(
    'INSERT INTO activity_logs (admin_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
    [adminId, action, details, ipAddress]
  );
};
```

### File Upload Security
```javascript
// Secure file upload configuration
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    if (file.mimetype === 'text/csv' || 
        file.originalname.endsWith('.csv') ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel (.xlsx) files are allowed'));
    }
  }
});
```

## Compliance Controls

### User Access Control
- **Role-based access**: Different levels of access based on user role
- **Default admin segregation**: Default admin account is handled separately
- **Access logs**: All access to the system is logged

### Audit Trail
- **Activity logs**: System maintains detailed logs of all administrator activities
- **Email logs**: All client communications are logged
- **Data change history**: Changes to critical data are recorded

### Data Protection
- **TLS/SSL**: All data transmissions use TLS/SSL encryption
- **Input validation**: All user inputs are validated to prevent injection attacks
- **CSRF protection**: Cross-site request forgery protection is implemented

## Security Testing

The application undergoes regular security testing:

1. **Input validation testing**: Ensuring all inputs are properly validated
2. **Authentication testing**: Verifying authentication mechanisms work correctly
3. **Session management testing**: Confirming sessions are handled securely
4. **Authorization testing**: Validating access control mechanisms
5. **Data protection testing**: Ensuring sensitive data is properly protected

## Incident Response Plan

In the event of a security incident:

1. **Immediate containment**: Steps to immediately contain the breach
2. **Assessment**: Determining the scope and impact of the incident
3. **Notification**: Process for notifying affected parties and regulators
4. **Remediation**: Steps to address the vulnerability and prevent recurrence
5. **Documentation**: Recording the incident and response for future audit

---

This technical documentation is provided to assist in the audit process and demonstrates the security measures in place to protect sensitive financial adviser and client data.

**Last Updated**: <%= new Date().toLocaleDateString() %> 