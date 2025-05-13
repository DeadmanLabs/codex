@echo off
REM Stop the running Codex CLI server Docker container
set CONTAINER_NAME=codex-cli-server

echo Stopping container '%CONTAINER_NAME%'...
docker stop %CONTAINER_NAME%
if %ERRORLEVEL% equ 0 (
  echo Container '%CONTAINER_NAME%' stopped.
) else (
  echo Failed to stop container '%CONTAINER_NAME%'. It may not be running.
  exit /b 1
)