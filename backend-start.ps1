$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node .\scripts\backend-control.js start

