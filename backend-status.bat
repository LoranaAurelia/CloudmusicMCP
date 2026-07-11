@echo off
setlocal
cd /d "%~dp0"
node scripts\backend-control.js status
pause

