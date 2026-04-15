#!/bin/sh
set -e

echo "=== Nakama Startup Script ==="
echo "DATABASE_URL is set: $(if [ -n "${DATABASE_URL}" ]; then echo 'YES'; else echo 'NO'; fi)"

if [ -z "${DATABASE_URL}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  echo "Please set DATABASE_URL in Render environment variables."
  exit 1
fi

# Show first 20 chars of DATABASE_URL for debugging (don't show password)
echo "DATABASE_URL starts with: $(echo "${DATABASE_URL}" | cut -c1-20)..."

# Convert DATABASE_URL from postgresql:// format to Nakama format
# Render format: postgresql://user:password@host:5432/database
# Nakama format: user:password@host:5432/database
DB_ADDR=$(echo "${DATABASE_URL}" | sed 's|^postgresql://||' | sed 's|^postgres://||')

echo "Converted DB address starts with: $(echo "${DB_ADDR}" | cut -c1-20)..."

# Wait for database to be ready
echo "Waiting 10 seconds for database..."
sleep 10

# Run database migrations
echo "Running database migrations..."
/nakama/nakama migrate up --database.address "${DB_ADDR}" || {
  echo "WARNING: Migration failed, but continuing..."
}

# Start Nakama server
echo "Starting Nakama server..."
exec /nakama/nakama --database.address "${DB_ADDR}" --session.token_expiry_sec 7200 --session.refresh_token_expiry_sec 3600
