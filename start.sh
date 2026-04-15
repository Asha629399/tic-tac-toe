#!/bin/sh

# Run database migrations
/nakama/nakama migrate up --database.address "${DATABASE_URL}"

# Start Nakama server
exec /nakama/nakama --database.address "${DATABASE_URL}" --session.token_expiry_sec 7200 --session.refresh_token_expiry_sec 3600
