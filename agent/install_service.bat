@echo off
title CloudPrint Pro - Agent Windows Service Setup
echo ================================================================
echo CloudPrint Pro - Local LAN Print Agent Service Installer
echo ================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js (v18+) from https://nodejs.org/
    pause
    exit /b 1
)

echo [2/3] Installing dependencies...
call npm install --no-audit

echo [3/3] Checking environment file (.env)...
if not exist ".env" (
    echo Creating .env from .env.example...
    copy .env.example .env
    echo Please configure your SERVER_URL and AGENT_TOKEN in .env
)

echo.
echo ================================================================
echo Starting CloudPrint Pro Agent Daemon...
echo Press Ctrl+C at any time to stop the agent.
echo ================================================================
node index.js
pause
