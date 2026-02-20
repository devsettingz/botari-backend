# Botari AI Database Migration Script for Windows PowerShell
# Usage: .\migrate.ps1 [up|down|status|create]

param(
    [Parameter(Position=0)]
    [string]$Command = "status"
)

$MIGRATIONS_DIR = "./migrations"
$DATABASE_URL = $env:DATABASE_URL

function Show-Status {
    Write-Host "=== Botari AI Migration Status ===" -ForegroundColor Cyan
    Write-Host "Database: $DATABASE_URL" -ForegroundColor Gray
    Write-Host ""
    
    $files = Get-ChildItem -Path $MIGRATIONS_DIR -Filter "*.sql" | Sort-Object Name
    Write-Host "Available migrations:" -ForegroundColor Yellow
    foreach ($file in $files) {
        Write-Host "  + $($file.Name)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Total: $($files.Count) migration files" -ForegroundColor Cyan
}

function Run-Migrations {
    Write-Host "=== Running Migrations ===" -ForegroundColor Cyan
    
    if (-not $DATABASE_URL) {
        Write-Host "ERROR: DATABASE_URL environment variable not set!" -ForegroundColor Red
        Write-Host "Please set it first:" -ForegroundColor Yellow
        Write-Host '  $env:DATABASE_URL = "postgresql://user:password@localhost:5432/botari"'
        exit 1
    }
    
    $files = Get-ChildItem -Path $MIGRATIONS_DIR -Filter "*.sql" | Sort-Object Name
    
    foreach ($file in $files) {
        Write-Host "Running $($file.Name)..." -ForegroundColor Yellow -NoNewline
        try {
            $content = Get-Content -Path $file.FullName -Raw
            $psql = Get-Command psql -ErrorAction SilentlyContinue
            if ($psql) {
                $content | & psql $DATABASE_URL 2>$null
                Write-Host " DONE" -ForegroundColor Green
            } else {
                Write-Host "" -ForegroundColor Red
                Write-Host "  (psql not found - install PostgreSQL command line tools)" -ForegroundColor Red
                Write-Host "  Manual command: psql $DATABASE_URL -f $($file.FullName)" -ForegroundColor Gray
                break
            }
        } catch {
            Write-Host " FAILED: $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`nMigrations complete!" -ForegroundColor Green
}

function Create-Migration {
    param([string]$Name)
    
    if (-not $Name) {
        $Name = Read-Host "Enter migration name (e.g., add_users_table)"
    }
    
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $filename = "{0}_{1}.sql" -f $timestamp, $Name
    $filepath = Join-Path $MIGRATIONS_DIR $filename
    
    $content = @"
-- Migration: $Name
-- Created: $(Get-Date)

-- Add your SQL here

"@
    
    $content | Out-File -FilePath $filepath -Encoding UTF8
    Write-Host "Created migration: $filename" -ForegroundColor Green
}

# Main
switch ($Command.ToLower()) {
    "up" { Run-Migrations }
    "down" { Write-Host "Rollback not implemented - do manually" -ForegroundColor Yellow }
    "create" { Create-Migration }
    default { Show-Status }
}
