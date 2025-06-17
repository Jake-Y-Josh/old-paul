#!/bin/bash

# Update the DATABASE_URL in the .env file to use sslmode=no-verify
# This will make the local .env file match the working configuration

# Backup current .env file
cp .env .env.old

# Update the .env file
sed -i '' 's|sslmode=require|sslmode=no-verify|g' .env
echo "NODE_TLS_REJECT_UNAUTHORIZED=0" >> .env

echo "Updated .env file to use sslmode=no-verify and NODE_TLS_REJECT_UNAUTHORIZED=0"
echo "Original .env file backed up as .env.old"