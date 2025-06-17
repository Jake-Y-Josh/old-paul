# Data Protection Impact Assessment (DPIA)
**Dynamic Financial Planning Ltd - Client Feedback System**

**Version 1.0**
**Date: March 21, 2025**

## 1. Purpose and Scope

This Data Protection Impact Assessment (DPIA) evaluates privacy risks associated with processing personal data within the Dynamic FP Feedback System, in compliance with UK GDPR and relevant FCA regulations.

### 1.1 System Purpose
The system collects client feedback on financial planning services provided by Dynamic Financial Planning Ltd, supporting service improvement while maintaining compliance with FCA requirements.

### 1.2 Data Controller
Dynamic Financial Planning Ltd
FCA Registered No. 223112
Company Registration No. 14946756
Buckinghamshire, UK

### 1.3 DPIA Author
Joshua Matthews
Director
March 21, 2025

## 2. Data Processing Activities

### 2.1 Personal Data Categories
The system collects and processes the following types of personal data:

| Data Category | Purpose | Legal Basis |
|---------------|---------|-------------|
| Client name (first and last) | Client identification | Legitimate interest |
| Email address | Sending feedback forms and confirmations | Legitimate interest |
| IP address | Security and audit | Legitimate interest |
| Feedback responses | Service improvement | Legitimate interest |
| Form submission timestamps | Audit and verification | Legitimate interest |
| Client IDs | Internal reference and data linking | Legitimate interest |
| Email delivery status | Service reliability monitoring | Legitimate interest |

### 2.2 Special Category Data
The system does not intentionally collect or process special category data. The feedback forms are designed to collect opinions on financial planning services only.

### 2.3 Data Flow
1. Client details entered into the system by administrators
2. Unique feedback links generated and sent to clients
3. Clients submit feedback through secure forms
4. Data stored in encrypted database (Supabase)
5. Administrators access feedback through secure dashboard

## 3. Necessity and Proportionality Assessment

### 3.1 Data Minimization
- Only essential client information is collected
- Feedback questions are specifically related to financial planning services
- No excessive data collection beyond what's necessary for service improvement

### 3.2 Accuracy
- Client data can be updated upon request
- Regular verification of client contact details
- Correction mechanisms available for inaccurate data

### 3.3 Retention
- Client feedback data retained for 5 years in accordance with GDPR and FCA guidelines
- Email logs retained for 2 years for audit and troubleshooting purposes
- Data automatically archived after the retention period
- Archived data permanently deleted after 7 years total retention

### 3.4 Information Provided to Data Subjects
- Privacy notice provided to clients before feedback submission
- Clear explanation of how data will be used
- Details on data subject rights and how to exercise them

## 4. Risk Assessment

### 4.1 Identified Risks

| Risk | Likelihood (1-5) | Impact (1-5) | Risk Level | Mitigation |
|------|-----------------|--------------|------------|------------|
| Unauthorized access to feedback data | 2 | 4 | Medium | Access controls, encryption, audit logs |
| Data breach of client contact details | 2 | 4 | Medium | Encryption, secure coding practices |
| Excessive data collection | 1 | 3 | Low | Regular review of data collection practices |
| Data retention beyond necessary period | 2 | 3 | Medium | Implement data retention schedule |
| Processing data for unrelated purposes | 1 | 4 | Low | Clear purpose limitation in policies |

### 4.2 Risk Mitigation Measures

#### Technical Controls
- Data encryption in transit (TLS 1.2+)
- Data encryption at rest (AES-256)
- Access controls based on user roles
- Secure email transmission (SPF/DKIM/DMARC)
- Secure authentication for admin access
- Audit logs for system activities

#### Organizational Controls
- Regular security awareness for administrators
- Clear data handling procedures
- Incident response procedure
- Regular security reviews
- Third-party security assessments (Supabase, Resend)

## 5. Consultation

### 5.1 Internal Stakeholders
- Feedback received from Paul Campion, Managing Director
- Concerns addressed regarding data storage location, backup procedures, business continuity, and user management oversight

### 5.2 External Stakeholders
- Client feedback on privacy aspects incorporated
- Regulatory guidance considered

## 6. Compliance and Risk Conclusion

### 6.1 Compliance Assessment
The Dynamic FP Feedback System has been designed with data protection principles in mind. The processing activities are:
- Lawful, fair, and transparent
- Limited to specific, explicit, and legitimate purposes
- Adequate, relevant, and limited to what is necessary
- Accurate and kept up to date
- Stored for no longer than necessary
- Processed securely with appropriate measures

### 6.2 Residual Risks
After implementing all mitigation measures, residual risks are considered acceptable for the processing activities described.

### 6.3 Approval
This DPIA has been reviewed and approved by the relevant stakeholders. Processing activities may proceed as described.

---

Approved by: _________________________  Date: _________________

Position: _____________________________

## 7. Implementation and Review

### 7.1 Actions Required
- Implement data retention procedures
- Review privacy notice for clarity
- Schedule security assessment review

### 7.2 Review Schedule
This DPIA will be reviewed:
- Annually from the date of approval
- Following significant system changes
- Following relevant regulatory changes
- Following any security incident