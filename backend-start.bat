@echo off
setlocal
cd /d "%~dp0"
node scripts\backend-control.js start
if errorlevel 1 pause

