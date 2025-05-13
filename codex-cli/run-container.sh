#!/usr/bin/env sh
# Run the Codex CLI server Docker container
IMAGE_NAME=codex-cli-server
CONTAINER_NAME=codex-cli-server
HOST_PORT=3000
CONTAINER_PORT=3000

if [ -z "${OPENAI_API_KEY}" ]; then
  echo "ERROR: OPENAI_API_KEY environment variable is not set." >&2
  exit 1
fi
echo "Starting container '${CONTAINER_NAME}' from image '${IMAGE_NAME}'..."
docker run --rm -d \
  --name ${CONTAINER_NAME} \
  -e OPENAI_API_KEY="${OPENAI_API_KEY}" \
  -p ${HOST_PORT}:${CONTAINER_PORT} \
  -p 27017:27017 \
  ${IMAGE_NAME}
if [ $? -eq 0 ]; then
  echo "Container '${CONTAINER_NAME}' is running on port ${HOST_PORT}."
  echo "Use './stop-container.sh' to stop it."
else
  echo "Failed to start container '${CONTAINER_NAME}'." >&2
  exit 1
fi