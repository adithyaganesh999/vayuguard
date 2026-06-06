#!/usr/bin/env bash
#
# VayuGuard Local Development Shutdown
# Stops all services and cleans up Docker resources
#
# Usage: ./scripts/local-dev-down.sh [--volumes] [--clean]
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
REMOVE_VOLUMES=""
CLEAN_ALL=false
for arg in "$@"; do
  case $arg in
    --volumes) REMOVE_VOLUMES="--volumes" ;;
    --clean)   CLEAN_ALL=true ;;
    --help)
      echo "Usage: $0 [--volumes] [--clean]"
      echo ""
      echo "Options:"
      echo "  --volumes  Remove Docker volumes (deletes database data)"
      echo "  --clean    Remove volumes, images, and orphans (full cleanup)"
      exit 0
      ;;
  esac
done

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  VayuGuard Local Development Shutdown${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

if $CLEAN_ALL; then
  REMOVE_VOLUMES="--volumes"
  echo -e "${YELLOW}⚠️  Full cleanup requested. This will remove:${NC}"
  echo -e "${YELLOW}  - All containers${NC}"
  echo -e "${YELLOW}  - All volumes (database data)${NC}"
  echo -e "${YELLOW}  - All related images${NC}"
  echo -e "${YELLOW}  - Orphaned containers${NC}"
  echo ""
  read -p "  Are you sure? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Cancelled.${NC}"
    exit 0
  fi
fi

# Check if compose file exists
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo -e "${YELLOW}⚠️  docker-compose.yml not found at $COMPOSE_FILE${NC}"
  echo -e "${BLUE}  Attempting to stop containers by name...${NC}"

  # Try to stop known containers
  for container in vayuguard-frontend vayuguard-backend vayuguard-ml vayuguard-mongo vayuguard-postgres vayuguard-redis; do
    if docker ps -a --format '{{.Names}}' | grep -q "$container"; then
      echo -e "  Stopping $container..."
      docker stop "$container" 2>/dev/null || true
      docker rm "$container" 2>/dev/null || true
    fi
  done

  echo -e "${GREEN}✅ Cleanup complete${NC}"
  exit 0
fi

# Show current status
echo -e "${BLUE}📋 Current containers:${NC}"
docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || echo "  No running containers found"
echo ""

# Stop services
echo -e "${BLUE}🛑 Stopping services...${NC}"

DOWN_FLAGS="--remove-orphans"

if [[ -n "$REMOVE_VOLUMES" ]]; then
  DOWN_FLAGS="$DOWN_FLAGS --volumes"
  echo -e "${YELLOW}  Removing volumes (database data will be deleted)${NC}"
fi

docker compose -f "$COMPOSE_FILE" down $DOWN_FLAGS

echo -e "${GREEN}  ✅ Services stopped${NC}"

# Full cleanup if requested
if $CLEAN_ALL; then
  echo ""
  echo -e "${BLUE}🧹 Cleaning up Docker resources...${NC}"

  # Remove related images
  echo -e "  Removing VayuGuard images..."
  docker images --format '{{.Repository}}:{{.Tag}}' | \
    grep -i vayuguard | \
    xargs -r docker rmi 2>/dev/null || true
  echo -e "${GREEN}  ✅ Images removed${NC}"

  # Remove dangling images
  echo -e "  Removing dangling images..."
  docker image prune -f &>/dev/null || true
  echo -e "${GREEN}  ✅ Dangling images removed${NC}"

  # Remove unused networks
  echo -e "  Removing unused networks..."
  docker network prune -f &>/dev/null || true
  echo -e "${GREEN}  ✅ Networks cleaned${NC}"
fi

# Clean up .env file in docker directory
if [[ -f "$PROJECT_DIR/infrastructure/docker/.env" ]]; then
  rm -f "$PROJECT_DIR/infrastructure/docker/.env"
  echo -e "${GREEN}  ✅ Docker .env file removed${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Shutdown complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  To start again: ${CYAN}./scripts/local-dev-up.sh${NC}"
echo -e "  With clean database: ${CYAN}./scripts/local-dev-up.sh --build${NC}"
echo ""
