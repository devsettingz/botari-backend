@echo off
REM Botari AI Database Migration Runner for Windows
REM Usage: run-migrations.bat

echo ==========================================
echo Botari AI Database Migration
echo ==========================================

if "%DATABASE_URL%"=="" (
    echo ERROR: DATABASE_URL environment variable not set!
    echo.
    echo Please set it first:
    echo   set DATABASE_URL=postgresql://user:password@localhost:5432/botari
    echo.
    pause
    exit /b 1
)

echo.
echo Database: %DATABASE_URL%
echo.

REM Check if psql is available
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: psql command not found!
    echo.
    echo Please install PostgreSQL command line tools or run the SQL files manually.
    echo.
    echo SQL files to run in order:
    for %%f in (migrations\*.sql) do (
        echo   - %%f
    )
    echo.
    pause
    exit /b 1
)

echo Running migrations...
echo.

for %%f in (migrations\*.sql) do (
    echo Running %%f ...
    psql %DATABASE_URL% -f "%%f" 2>nul
    if %errorlevel% equ 0 (
        echo   [OK] %%f
    ) else (
        echo   [FAIL] %%f - may already exist or error
    )
)

echo.
echo ==========================================
echo Migration complete!
echo ==========================================
pause
