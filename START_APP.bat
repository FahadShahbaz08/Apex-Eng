@echo off
setlocal
title Forma - Production and Accounts

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is required to run Forma.
  echo Install the current Node.js LTS release from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

set PORT=3000
set HOSTNAME=localhost
echo.
echo Starting Forma at http://localhost:3000
echo Keep this window open while using the application.
start "" http://localhost:3000
node server.js
