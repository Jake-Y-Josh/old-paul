# System Architecture & Security Document
**Dynamic Financial Planning Ltd - Client Feedback System**

**Version 1.0**
**Date: March 21, 2025**

## 1. System Overview

The Dynamic FP Feedback System is a web-based application designed to collect, store, and manage client feedback for financial planning services. The system enables secure submission of feedback through unique links sent to clients and provides administrative management of received feedback.

### 1.1 Purpose

This system enables Dynamic Financial Planning Ltd to:
- Collect structured feedback from financial planning clients
- Send automated feedback requests to clients
- Notify administrators of new feedback submissions
- Securely manage feedback data in compliance with FCA regulations

## 2. System Architecture

### 2.1 Technical Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend API | Node.js | Process requests, business logic, authentication |
| Database | Supabase (PostgreSQL) | Secure storage of user and feedback data |
| Email Service | Resend (Primary) | Secure delivery of client communications |
| Email Failover | SMTP (Secondary) | Backup email delivery system |
| Authentication | Email/Password | Admin access control |
| Hosting | [Your hosting provider] | Application hosting |

### 2.2 System Components Diagram

```
┌───────────────┐      ┌────────────────┐      ┌─────────────────┐
│               │      │                │      │                 │
│  Admin User   │─────▶│  Admin Portal  │─────▶│  Authentication │
│               │      │                │      │                 │
└───────────────┘      └────────────────┘      └─────────────────┘
                                │
                                ▼
┌───────────────┐      ┌────────────────┐      ┌─────────────────┐
│               │      │                │      │                 │
│  Client User  │─────▶│ Feedback Forms │─────▶│    Node.js      │
│               │      │                │      │    Backend      │
└───────────────┘      └────────────────┘      └─────────────────┘
                                                        │
                                                        ▼
                                           ┌──────────────────────┐
                                           │                      │
                                           │ Supabase PostgreSQL  │
                                           │     Database         │
                                           │                      │
                                           └──────────────────────┘
                                                        │
                                                        ▼
                                           ┌──────────────────────┐
                                           │                      │
                                           │   Resend Email       │
                                           │   Service (Primary)  │
                                           │                      │
                                           └──────────────────────┘
                                                        │
                                                        ▼
                                           ┌──────────────────────┐
                                           │                      │
                                           │   SMTP Email         │
                                           │   Service (Backup)   │
                                           │                      │
                                           └──────────────────────┘
```

## 3. Data Flow

### 3.1 Admin User Flow
1. Admin authenticates via email/password
2. Access granted to admin portal based on authentication
3. Admin can view feedback submissions, create new feedback forms
4. Admin can generate unique feedback links for clients
5. Admin receives notifications for new feedback submissions

### 3.2 Client User Flow
1. Client receives unique feedback link via email
2. Client submits feedback through secure form
3. Submission encrypted and stored in Supabase database
4. Confirmation email sent to client
5. Admin notified of new submission

## 4. Security Controls

### 4.1 Authentication & Access Control
- Email/password authentication for admin access
- No public login system - client access only via secure unique links
- Role-based access control (admin vs. client)
- Admin-only access to feedback management features
- Secure password reset mechanism

### 4.2 Data Protection
- All data encrypted in transit using TLS 1.2+
- Data encrypted at rest using AES-256 encryption
- Backend API accessible only via HTTPS
- IP address logging for audit purposes
- Parameter validation and sanitization to prevent injection attacks

### 4.3 API Security
- API keys stored in environment variables, not in code
- API requests authenticated and authorized
- Rate limiting to prevent abuse
- Input validation on all API endpoints

### 4.4 Email Security
- Resend email service with SPF, DKIM, and DMARC implementation
- Email transmission encrypted with TLS
- Secure fallback to SMTP if primary email service unavailable
- Email delivery status tracking and logging

## 5. Compliance Considerations

### 5.1 FCA Relevant Controls
- Secure handling of confidential financial client data
- Audit trails for all system actions
- Data access restricted to authorized personnel only
- Regular security reviews and updates

### 5.2 GDPR Compliance
- Client data processed only for the intended purpose
- Data minimization principles applied
- Client data can be exported or deleted upon request
- Privacy notices provided to all users

## 6. Monitoring and Incident Response

### 6.1 System Monitoring
- Email delivery logging (success/failure)
- Error logging for troubleshooting
- Performance monitoring
- Notification system for critical errors

### 6.2 Incident Response Summary
- Security incidents logged and tracked
- Defined process for incident investigation
- Client and regulatory notification procedures in place
- Post-incident review process

---

Approved by: _________________________  Date: _________________

Position: _____________________________
