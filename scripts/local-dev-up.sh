#!/usr/bin/env bash
#
# VayuGuard Local Development Startup
# Starts all services using docker-compose with health checks
#
# Usage: ./scripts/local-dev-up.sh [--build] [--detach]
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
COMPOSE_FILE="$PROJECT_DIR/infrastructure/docker/docker-compose.yml"

# Parse arguments
BUILD=""
DETACH=""
for arg in "$@"; do
  case $arg in
    --build)   BUILD="--build" ;;
    --detach)  DETACH="-d" ;;
    --help)
      echo "Usage: $0 [--build] [--detach]"
      echo ""
      echo "Options:"
      echo "  --build   Rebuild images before starting"
      echo "  --detach  Run in background"
      exit 0
      ;;
  esac
done

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  VayuGuard Local Development Environment${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✅ Docker found: $(docker --version)${NC}"

if ! docker compose version &>/dev/null; then
  echo -e "${RED}❌ Docker Compose v2 is not available.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✅ Docker Compose found: $(docker compose version --short)${NC}"

# Check if .env.dev exists
if [[ ! -f "$PROJECT_DIR/.env.dev" ]]; then
  echo -e "${YELLOW}  ⚠️  .env.dev not found. Using default environment variables.${NC}"
else
  echo -e "${GREEN}  ✅ .env.dev found${NC}"
fi

# Copy .env.dev to .env for docker-compose
if [[ -f "$PROJECT_DIR/.env.dev" ]]; then
  cp "$PROJECT_DIR/.env.dev" "$PROJECT_DIR/infrastructure/docker/.env"
  echo -e "${GREEN}  ✅ Environment file copied to docker directory${NC}"
fi

echo ""

# Stop any existing containers
echo -e "${BLUE}🛑 Stopping existing containers...${NC}"
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
echo -e "${GREEN}  ✅ Cleaned up${NC}"
echo ""

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"

COMPOSE_CMD="docker compose -f $COMPOSE_FILE up $BUILD $DETACH"
echo -e "  Running: $COMPOSE_CMD"
echo ""

eval "$COMPOSE_CMD"

# If running in detached mode, wait for health checks
if [[ -n "$DETACH" ]]; then
  echo ""
  echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
  echo ""

  MAX_WAIT=120  # seconds
  ELAPSED=0
  INTERVAL=5

  # Define services and their health check endpoints
  declare -A SERVICES=(
    ["mongodb"]="27017"
    ["postgres"]="5432"
    ["backend"]="5000"
    ["frontend"]="3000"
    ["ml-service"]="8000"
  )

  ALL_HEALTHY=false

  while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    ALL_HEALTHY=true
    echo -e "${BLUE}  Health check ( ${ELAPSED}s / ${MAX_WAIT}s ):${NC}"

    for service in mongodb postgres; do
      PORT="${SERVICES[$service]}"
      if docker compose -f "$COMPOSE_FILE" exec -T "$service" pg_isready &>/dev/null 2>&1 || \
         nc -z localhost "$PORT" 2>/dev/null; then
        echo -e "    ${GREEN}✅${NC} $service (port $PORT)"
      else
        echo -e "    ${YELLOW}⏳${NC} $service (port $PORT) - starting..."
        ALL_HEALTHY=false
      fi
    done

    # Check HTTP services
    for service in backend frontend ml-service; do
      PORT="${SERVICES[$service]}"
      if curl -sf "http://localhost:$PORT/health" &>/dev/null || \
         curl -sf "http://localhost:$PORT/api/health" &>/dev/null; then
        echo -e "    ${GREEN}✅${NC} $service (port $PORT)"
      else
        echo -e "    ${YELLOW}⏳${NC} $service (port $PORT) - starting..."
        ALL_HEALTHY=false
      fi
    done

    if $ALL_HEALTHY; then
      break
    fi

    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
  done

  echo ""

  if $ALL_HEALTHY; then
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ All services are healthy!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  else
    echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  ⚠️  Some services are still starting.${NC}"
    echo -e "${YELLOW}  Check status: docker compose -f $COMPOSE_FILE ps${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
  fi

  # Seed demo data
  echo ""
  echo -e "${BLUE}📊 Seeding demo data...${NC}"
  if command -v node &>/dev/null; then
    node "$PROJECT_DIR/scripts/seed-demo-data.js" --clean 2>/dev/null && \
      echo -e "${GREEN}  ✅ Demo data seeded${NC}" || \
      echo -e "${YELLOW}  ⚠️  Demo data seeding skipped (MongoDB may not be ready yet)${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Node.js not found. Run manually: node scripts/seed-demo-data.js${NC}"
  fi
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Service Endpoints:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  Frontend:    ${GREEN}http://localhost:3000${NC}"
echo -e "  Backend API: ${GREEN}http://localhost:5000${NC}"
echo -e "  ML Service:  ${GREEN}http://localhost:8000${NC}"
echo -e "  MongoDB:     ${GREEN}localhost:27017${NC}"
echo -e "  PostgreSQL:  ${GREEN}localhost:5432${NC}"
echo ""
echo -e "  API Docs:    ${GREEN}http://localhost:8000/docs${NC} (Swagger UI)"
echo -e "  Demo Login:  ${GREEN}admin@vayuguard.com / Admin123!${NC}"
echo ""
echo -e "  Logs:        docker compose -f $COMPOSE_FILE logs -f [service]"
echo -e "  Stop:        ./scripts/local-dev-down.sh"
echo ""
