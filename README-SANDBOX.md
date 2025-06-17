# Sandbox Environment Database Configuration

This application includes automatic detection of sandbox environments (like ChatGPT Codex) and falls back to a local database when remote connections are blocked.

## The Problem

When running in a sandbox environment, the application cannot connect to remote PostgreSQL servers because outbound connections to certain IP addresses are blocked for security reasons.

The error you're seeing (`ENETUNREACH`) indicates that the network cannot reach the remote servers. This is a limitation of the sandbox environment, not an issue with your application code or database configuration.

## Solution

The solution includes:

1. **Sandbox Environment Detection**: The application now automatically detects when it's running in a sandbox environment.

2. **Local Database Fallback**: When in a sandbox, the app uses a local PostgreSQL connection instead of trying to connect to remote servers.

3. **Environment Variables**: New environment variables let you control the behavior:
   - `SANDBOX_ENVIRONMENT=true` - Force sandbox mode and local database
   - `TEST_CONNECTIVITY=true` - Enable network connectivity testing to detect sandbox environments

## How to Use in a Sandbox Environment

1. **Install PostgreSQL locally**:
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo apt install postgresql
   sudo systemctl start postgresql
   
   # Windows
   # Download and install from https://www.postgresql.org/download/windows/
   ```

2. **Create a local database**:
   ```bash
   createdb postgres
   ```

3. **Set environment variables**:
   ```bash
   # Force sandbox mode if needed
   export SANDBOX_ENVIRONMENT=true
   ```

4. **Start the application**:
   ```bash
   npm start
   ```

The application will:
1. Detect the sandbox environment
2. Use a local PostgreSQL connection with default credentials
3. Initialize the database schema and sample data

## Default Local Database Configuration

When in sandbox mode, the application uses these default local PostgreSQL settings:

```
host: localhost
port: 5432
user: postgres
password: postgres
database: postgres
ssl: false
```

You can modify these defaults in the `getDbConfig` function in `src/database/db.js` if your local PostgreSQL configuration is different.

## Troubleshooting

- **"role 'postgres' does not exist"**: Create the postgres user:
  ```bash
  sudo -u postgres createuser -s postgres
  ```

- **"authentication failed for user 'postgres'"**: Set a password:
  ```bash
  sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
  ```

- **"database 'postgres' does not exist"**: Create the database:
  ```bash
  sudo -u postgres createdb postgres
  ```