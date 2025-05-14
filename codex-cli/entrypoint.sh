#!/usr/bin/env sh
# Entrypoint to run both MongoDB and Codex server with logging
set -eu
# MongoDB port (can be overridden via env)
MONGODB_PORT="${MONGODB_PORT:-27018}"

# Directories
DATA_DIR=/data/db
APP_DIR=/usr/src/app
LOG_DIR="$APP_DIR/logs"

# Create necessary directories
mkdir -p "$DATA_DIR" "$LOG_DIR"

echo "Starting MongoDB (logging to $LOG_DIR/mongod.log)..." | tee -a "$LOG_DIR/entrypoint.log"
## Start MongoDB in the background with logging
echo "Starting MongoDB on port $MONGODB_PORT (logging to $LOG_DIR/mongod.log)..." | tee -a "$LOG_DIR/entrypoint.log"
mongod --bind_ip_all --port "$MONGODB_PORT" --dbpath "$DATA_DIR" >> "$LOG_DIR/mongod.log" 2>&1 &
MONGOD_PID=$!

# Start the Codex server, piping both stdout and stderr to a log file
echo "Starting Codex server (logging to $LOG_DIR/server.log)..." | tee -a "$LOG_DIR/entrypoint.log"
exec sh -c "node dist/server.js 2>&1 | tee -a '$LOG_DIR/server.log'"