#!/usr/bin/env bash
set -euo pipefail

# Stop and remove the running 'codex' container
docker rm -f codex 2>/dev/null || true
echo "Stopped and removed 'codex' container."