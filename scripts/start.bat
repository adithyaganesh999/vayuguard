@echo off
REM =============================================================================
REM VayuGuard Local Development Startup (NO DOCKER REQUIRED)
REM Starts frontend and backend services directly with npm
REM =============================================================================

echo.
echo ================================================
echo   VayuGuard Local Development (No Docker)
echo ================================================
echo.

REM ─── Save the project directory ───────────────────────────────────────────
set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

echo [INFO] Project directory: %CD%
echo.

REM ─── Check Node.js ────────────────────────────────────────────────────────
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ first.
    echo         Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found:
node --version

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)
echo [OK] npm found:
npm --version

REM ─── Check that mern-frontend and mern-backend exist ──────────────────────
if not exist "mern-frontend" (
    echo [ERROR] 'mern-frontend' folder not found in %CD%
    echo         Make sure you run this script from the VayuGuard project root.
    pause
    exit /b 1
)
if not exist "mern-backend" (
    echo [ERROR] 'mern-backend' folder not found in %CD%
    echo         Make sure you run this script from the VayuGuard project root.
    pause
    exit /b 1
)

echo [OK] Project structure looks good
echo.

REM ─── Install frontend dependencies ────────────────────────────────────────
echo [1/5] Installing frontend dependencies...
cd /d "%CD%\mern-frontend"
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend npm install failed!
    cd /d "%PROJECT_DIR%"
    pause
    exit /b 1
)
cd /d "%PROJECT_DIR%"
echo [OK] Frontend dependencies installed
echo.

REM ─── Install backend dependencies ─────────────────────────────────────────
echo [2/5] Installing backend dependencies...
cd /d "%CD%\mern-backend"
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend npm install failed!
    cd /d "%PROJECT_DIR%"
    pause
    exit /b 1
)
cd /d "%PROJECT_DIR%"
echo [OK] Backend dependencies installed
echo.

REM ─── Create .env files if they don't exist ────────────────────────────────
echo [3/5] Setting up environment files...

if not exist "mern-frontend\.env" (
    echo DATABASE_URL="file:./db/custom.db"> mern-frontend\.env
    echo NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1>> mern-frontend\.env
    echo NEXT_PUBLIC_ML_API_URL=http://localhost:8000/api/ml>> mern-frontend\.env
    echo NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png>> mern-frontend\.env
    echo [OK] Created mern-frontend\.env
) else (
    echo [OK] mern-frontend\.env already exists
)

if not exist "mern-backend\.env" (
    echo NODE_ENV=development> mern-backend\.env
    echo PORT=5000>> mern-backend\.env
    echo MONGODB_URI=mongodb://localhost:27017/vayuguard>> mern-backend\.env
    echo JWT_SECRET=dev-jwt-secret-change-in-production-abc123>> mern-backend\.env
    echo JWT_EXPIRES_IN=24h>> mern-backend\.env
    echo CORS_ORIGIN=http://localhost:3000>> mern-backend\.env
    echo LOG_LEVEL=debug>> mern-backend\.env
    echo ML_SERVICE_URL=http://localhost:8000>> mern-backend\.env
    echo [OK] Created mern-backend\.env
) else (
    echo [OK] mern-backend\.env already exists
)

echo.

REM ─── Setup Prisma ─────────────────────────────────────────────────────────
echo [4/5] Setting up Prisma database...
cd /d "%CD%\mern-frontend"
call npx prisma generate
call npx prisma db push
cd /d "%PROJECT_DIR%"
echo [OK] Prisma ready
echo.

REM ─── Start services ───────────────────────────────────────────────────────
echo [5/5] Starting services...
echo.
echo ================================================
echo   Services Starting!
echo ================================================
echo.
echo   Frontend:    http://localhost:3000
echo   Backend API: http://localhost:5000
echo.
echo   - Backend runs in STANDALONE mode (no MongoDB needed)
echo   - Frontend uses Prisma/SQLite (works out of the box)
echo   - Two new windows will open for each service
echo.

REM ─── Start Backend in a new window ────────────────────────────────────────
start "VayuGuard - Backend (Port 5000)" cmd /k "cd /d "%CD%\mern-backend" && echo Starting VayuGuard Backend... && npx nodemon src/server.js"

REM Wait 2 seconds before starting frontend
timeout /t 2 /nobreak >nul

REM ─── Start Frontend in a new window ───────────────────────────────────────
start "VayuGuard - Frontend (Port 3000)" cmd /k "cd /d "%CD%\mern-frontend" && echo Starting VayuGuard Frontend... && npm run dev"

echo.
echo [OK] Both services started in separate windows!
echo.
echo   - Open your browser: http://localhost:3000
echo   - Close the windows to stop the services
echo.
pause
