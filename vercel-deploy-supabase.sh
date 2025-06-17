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

# Ensure Supabase environment variables are set
SUPABASE_URL="https://hsacflpklcasjgffgzwd.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWNmbHBrbGNhc2pnZmZnendkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2ODEyMjgsImV4cCI6MjA1NzI1NzIyOH0.jyZb70tFxskfVI_VOs_DJU6NRXe6jVZE_qCT1t09ExU"

# Generate a session secret if not set
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  echo "Generated a random SESSION_SECRET for this deployment"
fi

# Deploy with updated environment variables
echo "Deploying to Vercel with Supabase configuration..."

# Deploy to production
vercel deploy --prod \
  -e NODE_ENV="production" \
  -e SUPABASE_URL="$SUPABASE_URL" \
  -e SUPABASE_KEY="$SUPABASE_KEY" \
  -e SESSION_SECRET="$SESSION_SECRET"

echo "Deployment complete!"
echo ""
echo "IMPORTANT: Admin login fix has been applied."
echo "Login with username: admin, password: admin123"
echo ""
echo "This deployment uses the Supabase client library instead of direct PostgreSQL connections."
echo "This should resolve the database connection issues across all environments."