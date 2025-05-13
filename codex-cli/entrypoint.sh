#!/usr/bin/env sh
# Entrypoint to run both MongoDB and Codex server

# Create data directory if missing
mkdir -p /data/db

# Start MongoDB in the background
mongod --bind_ip_all --dbpath /data/db &

# Start the Codex server
exec node dist/server.js