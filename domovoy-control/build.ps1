#!/usr/bin/env pwsh
# Build domovoy-control.zip for installation via focus-dashboard admin panel.
# Run from the domovoy-control/ directory.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot

# 1. Build React widget
Push-Location "$root/frontend"
Write-Host "→ Installing frontend dependencies..."
bun install --frozen-lockfile
Write-Host "→ Building widget.js..."
bun run build
Pop-Location

# dist/widget.js is output by Vite to $root/dist/widget.js

# 2. Package ZIP
$zip = "$root/domovoy-control.zip"
if (Test-Path $zip) { Remove-Item $zip }

Write-Host "→ Packaging $zip..."
Compress-Archive -Path `
    "$root/manifest.json", `
    "$root/dist/widget.js", `
    "$root/migrations.sql" `
    -DestinationPath $zip

$size = (Get-Item $zip).Length / 1KB
Write-Host "✓ Built: domovoy-control.zip  ($([math]::Round($size, 1)) KB)"
