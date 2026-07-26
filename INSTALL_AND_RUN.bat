@echo off
setlocal
title Apex Engineering ERP - Install and Run

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed or is not available in PATH.
  echo Install the current Node.js LTS release from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules\next\package.json (
  echo Installing application packages...
  where pnpm >nul 2>nul
  if not errorlevel 1 (
    call pnpm install
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo.
    echo Package installation failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting Apex Engineering ERP at http://localhost:3000
echo Keep this window open while using the application.
start "" http://localhost:3000
call npm run dev
