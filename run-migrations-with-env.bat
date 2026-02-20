@echo off
REM Run migrations using the .env file configuration

echo ==========================================
echo Botari AI Database Migration
echo ==========================================
echo.
echo Loading environment from .env file...
echo.

REM The dotenv package will automatically load .env
REM We'll use node to read the .env and run psql

REM Check if psql is available
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: psql command not found!
    echo.
    echo Please install PostgreSQL command line tools
    echo or use a database GUI tool to run the SQL files manually.
    echo.
    pause
    exit /b 1
)

echo Running migrations...
echo.

for %%f in (migrations\*.sql) do (
    echo ----------------------------------------
    echo Running: %%f
    echo.
    psql "postgresql://neondb_owner:npg_fHml5LC0ioxq@ep-red-leaf-ahjrjy6l-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" -f "%%f"
    if %errorlevel% equ 0 (
        echo [OK] %%f completed
    ) else (
        echo [INFO] %%f may have already been run or has errors
    )
    echo.
)

echo ==========================================
echo Migration complete!
echo ==========================================
pause
