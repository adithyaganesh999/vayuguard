#!/usr/bin/env bash
#
# VayuGuard Local Development Startup (NO DOCKER REQUIRED)
# Starts frontend and backend services directly with npm
#
# Usage: ./scripts/local-dev-no-docker.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  VayuGuard Local Development (No Docker)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# ─── Check Node.js ───────────────────────────────────────────────────────────
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✅ Node.js: $(node --version)${NC}"

if ! command -v npm &>/dev/null; then
  echo -e "${RED}❌ npm is not installed.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✅ npm: $(npm --version)${NC}"

# ─── Install dependencies if needed ─────────────────────────────────────────
if [ ! -d "$PROJECT_DIR/mern-frontend/node_modules" ]; then
  echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
  cd "$PROJECT_DIR/mern-frontend" && npm install
fi

if [ ! -d "$PROJECT_DIR/mern-backend/node_modules" ]; then
  echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
  cd "$PROJECT_DIR/mern-backend" && npm install
fi

# ─── Copy .env.dev to mern-frontend if no .env exists ────────────────────────
if [ ! -f "$PROJECT_DIR/mern-frontend/.env" ]; then
  echo -e "${YELLOW}📝 Creating frontend .env from .env.dev...${NC}"
  cat > "$PROJECT_DIR/mern-frontend/.env" << 'EOF'
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_ML_API_URL=http://localhost:8000/api/ml
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
EOF
  echo -e "${GREEN}  ✅ Frontend .env created${NC}"
fi

# ─── Copy .env.dev to mern-backend if no .env exists ────────────────────────
if [ ! -f "$PROJECT_DIR/mern-backend/.env" ]; then
  echo -e "${YELLOW}📝 Creating backend .env from .env.dev...${NC}"
  cat > "$PROJECT_DIR/mern-backend/.env" << 'EOF'
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/vayuguard
JWT_SECRET=dev-jwt-secret-change-in-production-abc123
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
ML_SERVICE_URL=http://localhost:8000
EOF
  echo -e "${GREEN}  ✅ Backend .env created${NC}"
fi

# ─── Initialize Prisma DB ────────────────────────────────────────────────────
echo -e "${BLUE}🗄️  Setting up Prisma database...${NC}"
cd "$PROJECT_DIR/mern-frontend"
npx prisma generate 2>/dev/null
npx prisma db push 2>/dev/null || echo -e "${YELLOW}  ⚠️ Prisma db push skipped (DB may already exist)${NC}"
echo -e "${GREEN}  ✅ Prisma ready${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Starting Services...${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend:    ${GREEN}http://localhost:3000${NC}"
echo -e "  Backend API: ${GREEN}http://localhost:5000${NC}"
echo -e "  (Backend will run in STANDALONE mode without MongoDB/Redis)"
echo -e "  (All features work using Prisma/SQLite in the frontend)"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo ""

# ─── Start Backend in background ─────────────────────────────────────────────
cd "$PROJECT_DIR/mern-backend"
(npx nodemon src/server.js 2>&1 | sed 's/^/[Backend] /') &
BACKEND_PID=$!

# ─── Start Frontend ─────────────────────────────────────────────────────────
cd "$PROJECT_DIR/mern-frontend"
(npm run dev 2>&1 | sed 's/^/[Frontend] /') &
FRONTEND_PID=$!

# ─── Trap exit to kill both processes ────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Stopping services...${NC}"
  kill $FRONTEND_PID 2>/dev/null
  kill $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  echo -e "${GREEN}  ✅ All services stopped${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
