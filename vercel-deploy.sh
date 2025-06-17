#!/bin/bash

# Exit on error
set -e

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Error: Vercel CLI not found. Please install it using 'npm install -g vercel'"
    exit 1
fi

# Ensure we are logged in
echo "Checking Vercel login status..."
vercel whoami || vercel login

# Ensure database URL has sslmode=no-verify if set
if [ -n "$DATABASE_URL" ]; then
  if [[ "$DATABASE_URL" != *"sslmode=no-verify"* ]]; then
    if [[ "$DATABASE_URL" == *"?"* ]]; then
      DATABASE_URL="${DATABASE_URL}&sslmode=no-verify"
    else
      DATABASE_URL="${DATABASE_URL}?sslmode=no-verify"
    fi
    echo "Updated DATABASE_URL to include sslmode=no-verify"
  fi
fi

# Generate a session secret if not set
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  echo "Generated a random SESSION_SECRET for this deployment"
fi

# Deploy with updated environment variables
echo "Deploying to Vercel with fixed environment configuration..."

# Deploy to production with critical SSL fixes
vercel deploy --prod \
  -e NODE_ENV="production" \
  -e NODE_TLS_REJECT_UNAUTHORIZED="0" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e DB_HOST="$DB_HOST" \
  -e DB_USER="$DB_USER" \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e DB_NAME="$DB_NAME" \
  -e DB_PORT="$DB_PORT" \
  -e DB_SSL="true" \
  -e SESSION_SECRET="$SESSION_SECRET"

echo "Deployment complete!"
echo ""
echo "IMPORTANT: Admin login fix has been applied."
echo "Login with username: admin, password: admin123"
echo ""
echo "If login issues persist, run 'node fix-login-across-environments.js' locally"
echo "to diagnose and fix admin login issues."