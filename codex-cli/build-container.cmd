@echo off
REM Build the Docker image for the Codex CLI server
set IMAGE_NAME=codex-cli-server

echo Building Docker image '%IMAGE_NAME%'...
docker build -t %IMAGE_NAME% .
if %ERRORLEVEL% equ 0 (
  echo Docker image '%IMAGE_NAME%' built successfully.
) else (
  echo Failed to build Docker image '%IMAGE_NAME%'.
  exit /b 1
)