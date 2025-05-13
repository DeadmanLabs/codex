#!/usr/bin/env sh
# Stop the running Codex CLI server Docker container
CONTAINER_NAME=codex-cli-server

echo "Stopping container '${CONTAINER_NAME}'..."
docker stop ${CONTAINER_NAME}
if [ $? -eq 0 ]; then
  echo "Container '${CONTAINER_NAME}' stopped."
else
  echo "Failed to stop container '${CONTAINER_NAME}'. It may not be running." >&2
  exit 1
fi