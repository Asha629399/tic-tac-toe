#!/bin/sh

echo "Starting Nakama..."

# Convert DATABASE_URL from postgresql:// format to Nakama format
# Render format: postgresql://user:password@host:5432/database
# Nakama format: user:password@host:5432/database

if [ -z "${DATABASE_URL}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

# Remove postgresql:// or postgres:// prefix
DB_ADDR=$(echo "${DATABASE_URL}" | sed 's|^postgresql://||' | sed 's|^postgres://||')

echo "Converted database address: ${DB_ADDR}"

# Wait for database to be ready
echo "Waiting for database..."
sleep 10

# Run database migrations
echo "Running migrations..."
/nakama/nakama migrate up --database.address "${DB_ADDR}"

if [ $? -ne 0 ]; then
  echo "Migration failed, but continuing to start server..."
fi

# Start Nakama server
echo "Starting Nakama server..."
exec /nakama/nakama --database.address "${DB_ADDR}" --session.token_expiry_sec 7200 --session.refresh_token_expiry_sec 3600
