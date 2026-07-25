@echo off
echo Starting ProspectAI Development Environment...
echo.

REM Check Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start Redis
echo [1/3] Starting Redis...
docker-compose up -d redis
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Redis.
    pause
    exit /b 1
)
echo [OK] Redis running on port 6379

REM Check env files exist
if not exist "apps\backend\.env" (
    echo.
    echo [WARNING] apps\backend\.env not found!
    echo Please copy apps\backend\.env.example to apps\backend\.env and fill in your keys.
    echo.
    pause
    exit /b 1
)
if not exist "apps\frontend\.env.local" (
    echo.
    echo [WARNING] apps\frontend\.env.local not found!
    echo Please copy apps\frontend\.env.example to apps\frontend\.env.local and fill in your keys.
    echo.
    pause
    exit /b 1
)

echo [2/3] Starting Backend (port 4000)...
start "ProspectAI Backend" cmd /k "cd apps\backend && npx tsx src/server.ts"

timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend (port 3000)...
start "ProspectAI Frontend" cmd /k "cd apps\frontend && npx next dev"

echo.
echo ============================================================
echo  ProspectAI is starting up!
echo.
echo  Frontend:  http://localhost:3000
echo  Backend:   http://localhost:4000
echo  API Docs:  http://localhost:4000/docs
echo  Redis UI:  http://localhost:3001 (if bull-board is running)
echo ============================================================
echo.
echo Both servers are opening in separate windows.
echo Close those windows to stop the servers.
pause
