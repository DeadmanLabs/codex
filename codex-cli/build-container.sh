#!/usr/bin/env sh
# Build the Docker image for the Codex CLI server
IMAGE_NAME=codex-cli-server

echo "Building Docker image '${IMAGE_NAME}'..."
docker build -t ${IMAGE_NAME} .
if [ $? -eq 0 ]; then
  echo "Docker image '${IMAGE_NAME}' built successfully."
else
  echo "Failed to build Docker image '${IMAGE_NAME}'." >&2
  exit 1
fi