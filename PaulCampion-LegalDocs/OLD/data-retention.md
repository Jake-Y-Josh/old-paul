# Data Retention Policy
**Dynamic Financial Planning Ltd - Client Feedback System**

**Version 1.0**
**Date: March 21, 2025**

## 1. Introduction

### 1.1 Purpose
This Data Retention Policy establishes guidelines for the appropriate retention and deletion of data within the Dynamic FP Feedback System. It is designed to ensure compliance with legal and regulatory requirements while managing data storage efficiently.

### 1.2 Scope
This policy applies to all data stored within the Dynamic FP Feedback System, including client personal information, feedback responses, system logs, and administrative data.

### 1.3 Compliance Requirements
This policy is designed to comply with:
- UK General Data Protection Regulation (GDPR)
- Data Protection Act 2018
- Financial Conduct Authority (FCA) requirements
- Contractual obligations with Dynamic Financial Planning Ltd

## 2. Data Categories and Retention Periods

### 2.1 Client Personal Data

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Client names | 3 years from last interaction | Business relationship management |
| Client email addresses | 3 years from last interaction | Business relationship management |
| Client IDs | 3 years from last interaction | System functionality and continuity |

### 2.2 Feedback Data

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Feedback responses | 3 years from submission | Service improvement, regulatory compliance |
| Form submission timestamps | 3 years from submission | Audit requirements, data integrity |
| Form IDs | 3 years from submission | System functionality and data relationships |

### 2.3 System Data

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Email delivery status | 1 year | Troubleshooting, service quality monitoring |
| IP addresses | 90 days | Security monitoring, fraud prevention |
| Authentication logs | 1 year | Security monitoring, incident investigation |
| Error logs | 90 days | System troubleshooting and optimization |

### 2.4 Administrative Data

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Admin account details | Duration of service + 1 year | System administration |
| Form templates | Duration of service | System functionality |
| System configuration | Duration of service | System functionality |

## 3. Data Retention Procedures

### 3.1 Data Storage
- Client data stored in encrypted Supabase database
- System logs stored in application logging system
- Email logs stored in Resend and database

### 3.2 Retention Implementation
- Quarterly review of data against retention periods
- Automated flagging of data approaching retention limit
- Manual review before any data deletion
- Retention periods calculated from clearly defined start points

### 3.3 Data Archiving
- Data reaching end of active retention period archived before deletion
- Archived data maintained in separate secure storage
- Archived data accessible only for compliance or legal purposes
- Archived data subject to extended retention period as specified above

## 4. Data Deletion

### 4.1 Deletion Methods
- Database records securely deleted using appropriate commands
- Archived data securely erased when retention period expires
- Confirmation of deletion recorded in deletion log

### 4.2 Deletion Exceptions
Deletion may be suspended in the following circumstances:
- Legal hold due to investigation or litigation
- Regulatory requirement for extended retention
- Client request with legitimate justification
- System backup restoration needs

### 4.3 Deletion Verification
- Regular audits to verify deletion procedures are followed
- Confirmation that deletion is complete and irreversible
- Validation that no residual data remains in systems

## 5. Responsibilities

### 5.1 System Owner Responsibilities
As the sole developer and system owner, [YOUR NAME] is responsible for:
- Implementing retention periods in system design
- Performing regular data reviews
- Executing deletion procedures
- Documenting all retention actions
- Updating this policy as required

### 5.2 Client Responsibilities
Dynamic Financial Planning Ltd is responsible for:
- Providing guidance on regulatory retention requirements
- Approving exceptions to standard retention periods
- Communicating any changes in regulatory requirements

## 6. Data Subject Requests

### 6.1 Right to Erasure
- Data subject erasure requests processed within 30 days
- Verification of identity before processing requests
- Documentation of all erasure actions
- Exceptions clearly communicated to data subjects

### 6.2 Data Subject Access Requests
- Retention information provided in response to access requests
- Clear explanation of retention periods and justification
- Process for requesting deletion explained

## 7. Policy Review and Updates

### 7.1 Review Schedule
This policy will be reviewed:
- Annually from the date of approval
- Following significant system changes
- Following relevant regulatory changes
- Following any security incident involving data retention

### 7.2 Revision History
| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | [CURRENT DATE] | Initial policy | [YOUR NAME] |

## 8. Compliance and Enforcement

### 8.1 Compliance Monitoring
- Regular audits of retention implementation
- Verification of deletion procedures
- Documentation of all retention activities

### 8.2 Consequences of Non-Compliance
Failure to comply with this policy may result in:
- Regulatory penalties
- Breach of contractual obligations
- Reputational damage
- Unintended disclosure of personal data

---

Approved by: _________________________  Date: _________________

Position: _____________________________
