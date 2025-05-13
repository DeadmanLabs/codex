@echo off
REM Run the Codex CLI server Docker container
set IMAGE_NAME=codex-cli-server
set CONTAINER_NAME=codex-cli-server
set HOST_PORT=3000
set CONTAINER_PORT=3000

if not defined OPENAI_API_KEY (
  echo ERROR: OPENAI_API_KEY environment variable is not set. 1>&2
  exit /b 1
)
echo Starting container '%CONTAINER_NAME%' from image '%IMAGE_NAME%'...
docker run --rm -d ^
  --name %CONTAINER_NAME% ^
  -e OPENAI_API_KEY=%OPENAI_API_KEY% ^
  -p %HOST_PORT%:%CONTAINER_PORT% ^
  -p 27017:27017 ^
  %IMAGE_NAME%
if %ERRORLEVEL% equ 0 (
  echo Container '%CONTAINER_NAME%' is running on port %HOST_PORT%.
  echo Use 'stop-container.cmd' to stop it.
) else (
  echo Failed to start container '%CONTAINER_NAME%'.
  exit /b 1
)