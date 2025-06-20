# Supabase Authentication Implementation

This document describes the Supabase Authentication implementation for the Client Feedback Management System.

## Overview

The application has been updated to use Supabase Auth as the primary authentication system, replacing the previous session-based authentication. This provides enhanced security, better session management, and built-in features like password reset and user invitations.

## Key Changes

### 1. Login System
- **Previous**: Session-based authentication with bcrypt password hashing
- **New**: Supabase Auth `signInWithPassword` method
- **Location**: `src/controllers/adminController.js` - `login` function

The system now:
- Uses Supabase Auth for password verification
- Stores Supabase session tokens in Express sessions
- Supports username-based login by looking up the email first

### 2. Authentication Middleware
- **Previous**: Checked Express session for `adminId`
- **New**: Validates Supabase Auth tokens
- **Location**: `src/middlewares/auth.js`

The middleware now:
- Validates Supabase access tokens
- Automatically refreshes expired tokens using refresh tokens
- Falls back to remember tokens for persistent login

### 3. Logout
- **Previous**: Destroyed Express session only
- **New**: Signs out from Supabase Auth and destroys session
- **Location**: `src/controllers/adminController.js` - `logout` function

### 4. Password Reset
- **Previous**: Custom token-based reset system
- **New**: Supabase Auth `resetPasswordForEmail`
- **Location**: `src/controllers/adminController.js` - `forgotPassword` and `resetPassword` functions

The new flow:
- Sends password reset emails via Supabase
- Uses Supabase's secure token validation
- Updates both Supabase Auth and local database

### 5. User Invitations
- **Previous**: Custom invitation tokens
- **New**: Supabase Auth `inviteUserByEmail`
- **Location**: `src/controllers/userController.js` - `createUser` function

## Migration Process

### For Existing Users

Run the migration script to create Supabase Auth accounts for existing admin users:

```bash
node migrate-to-supabase-auth.js
```

This script:
1. Creates Supabase Auth accounts for all existing admins
2. Sends password reset emails to all users
3. Maintains backward compatibility during migration

### For New Users

New users are automatically created in both Supabase Auth and the local database.

## Environment Variables

Ensure these Supabase-related environment variables are set:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Important Notes

1. **Default Admin Account**: The hardcoded admin/admin123 account has been removed. Use Supabase Auth for all authentication.

2. **Session Management**: While Supabase Auth handles authentication, Express sessions are still used for storing user state and Supabase tokens.

3. **Password Requirements**: Supabase Auth enforces minimum password requirements. Ensure your password policies align.

4. **Email Configuration**: Supabase handles password reset and invitation emails. Configure your email settings in the Supabase dashboard.

## Testing the Implementation

1. **Test Login**:
   - Try logging in with existing credentials
   - Verify session creation and token storage

2. **Test Password Reset**:
   - Request a password reset
   - Check email delivery
   - Complete the reset process

3. **Test User Invitations**:
   - Create a new user
   - Verify invitation email is sent
   - Complete the invitation acceptance

4. **Test Session Validation**:
   - Access protected routes
   - Verify token validation
   - Test token refresh on expiry

## Rollback Plan

If you need to rollback to the previous authentication system:

1. Revert the changes in `adminController.js`, `auth.js`, and `userController.js`
2. Remove Supabase Auth related code
3. Ensure the session-based authentication is restored
4. Test thoroughly before deploying

## Security Considerations

1. **Token Storage**: Supabase tokens are stored in server-side sessions, not in cookies
2. **HTTPS Required**: Always use HTTPS in production to protect tokens in transit
3. **Token Refresh**: Tokens are automatically refreshed to maintain security
4. **Password Hashing**: Supabase handles password hashing with industry-standard algorithms

## Support

For issues related to Supabase Auth:
- Check the [Supabase Auth documentation](https://supabase.com/docs/guides/auth)
- Review the application logs for authentication errors
- Ensure all environment variables are correctly set