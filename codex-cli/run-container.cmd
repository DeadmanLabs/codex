@echo off
REM Run the Codex CLI server Docker container
set IMAGE_NAME=codex-cli-server
set CONTAINER_NAME=codex-cli-server
set HOST_PORT=3000
set CONTAINER_PORT=3000

:: Default MongoDB port (host and container)
if not defined MONGODB_PORT (
  set MONGODB_PORT=27018
)

if not defined OPENAI_API_KEY (
  echo ERROR: OPENAI_API_KEY environment variable is not set. 1>&2
  exit /b 1
)
echo Starting container '%CONTAINER_NAME%' from image '%IMAGE_NAME%'...
REM Ensure host logs directory exists for mount
if not exist "%~dp0logs" mkdir "%~dp0logs"
docker run --rm -d ^
  --name %CONTAINER_NAME% ^
  -e OPENAI_API_KEY=%OPENAI_API_KEY% ^
  -e MONGODB_URI=%MONGODB_URI% ^
  -e MONGODB_HOST=%MONGODB_HOST% ^
  -e MONGODB_PORT=%MONGODB_PORT% ^
  -p %HOST_PORT%:%CONTAINER_PORT% ^
  -p %MONGODB_PORT%:%MONGODB_PORT% ^
  -v "%~dp0logs:/usr/src/app/logs" ^
  %IMAGE_NAME%
if %ERRORLEVEL% equ 0 (
  echo Container '%CONTAINER_NAME%' is running on port %HOST_PORT%.
  echo Use 'stop-container.cmd' to stop it.
) else (
  echo Failed to start container '%CONTAINER_NAME%'.
  exit /b 1
)