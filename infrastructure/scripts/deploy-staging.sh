#!/usr/bin/env bash
# =============================================================================
# VayuGuard - Staging Deployment Script
# =============================================================================
# Builds Docker images, pushes to registry, and deploys via docker-compose
# Usage: ./deploy-staging.sh [--skip-build] [--skip-push]
# =============================================================================

set -euo pipefail

# ---------- Configuration ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/infrastructure/docker/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env.staging"
IMAGE_TAG="${IMAGE_TAG:-staging-$(date +%Y%m%d-%H%M%S)}"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/vayuguard}"
COMPOSE_PROJECT_NAME="vayuguard-staging"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------- Helper Functions ----------
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prerequisites() {
    log_info "Checking prerequisites..."
    local missing=0

    for cmd in docker docker-compose git curl; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "Required command not found: $cmd"
            missing=1
        fi
    done

    if [[ "$missing" -eq 1 ]]; then
        log_error "Missing required tools. Please install them and try again."
        exit 1
    fi

    # Check Docker daemon is running
    if ! docker info &>/dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi

    # Check for .env.staging file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warn "No .env.staging file found. Creating template..."
        cat > "$ENV_FILE" <<EOF
# VayuGuard Staging Environment
JWT_SECRET=$(openssl rand -hex 32)
MONGO_PASSWORD=$(openssl rand -hex 16)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
GRAFANA_PASSWORD=$(openssl rand -hex 16)
GRAFANA_USER=admin
EOF
        log_ok "Created .env.staging with generated secrets"
    fi

    log_ok "All prerequisites met"
}

# ---------- Parse Arguments ----------
SKIP_BUILD=false
SKIP_PUSH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build) SKIP_BUILD=true; shift ;;
        --skip-push)  SKIP_PUSH=true;  shift ;;
        -h|--help)
            echo "Usage: $0 [--skip-build] [--skip-push]"
            echo ""
            echo "Options:"
            echo "  --skip-build   Skip Docker image building"
            echo "  --skip-push    Skip pushing images to registry"
            exit 0
            ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------- Main Deployment ----------
main() {
    log_info "========================================"
    log_info "VayuGuard Staging Deployment"
    log_info "Image Tag: ${IMAGE_TAG}"
    log_info "Registry:  ${REGISTRY}"
    log_info "========================================"

    check_prerequisites

    # Step 1: Build Docker images
    if [[ "$SKIP_BUILD" == false ]]; then
        log_info "Step 1/5: Building Docker images..."

        log_info "Building frontend image..."
        docker build \
            -f "${PROJECT_ROOT}/infrastructure/docker/Dockerfile.mern-frontend" \
            -t "${REGISTRY}/vayuguard-frontend:${IMAGE_TAG}" \
            -t "${REGISTRY}/vayuguard-frontend:staging-latest" \
            "${PROJECT_ROOT}"

        log_info "Building backend image..."
        docker build \
            -f "${PROJECT_ROOT}/infrastructure/docker/Dockerfile.mern-backend" \
            -t "${REGISTRY}/vayuguard-backend:${IMAGE_TAG}" \
            -t "${REGISTRY}/vayuguard-backend:staging-latest" \
            "${PROJECT_ROOT}"

        log_info "Building ML service image..."
        docker build \
            -f "${PROJECT_ROOT}/infrastructure/docker/Dockerfile.ml" \
            -t "${REGISTRY}/vayuguard-ml-service:${IMAGE_TAG}" \
            -t "${REGISTRY}/vayuguard-ml-service:staging-latest" \
            "${PROJECT_ROOT}"

        log_ok "All images built successfully"
    else
        log_warn "Skipping image build (--skip-build)"
    fi

    # Step 2: Push images to registry
    if [[ "$SKIP_PUSH" == false ]]; then
        log_info "Step 2/5: Pushing images to registry..."

        docker push "${REGISTRY}/vayuguard-frontend:${IMAGE_TAG}"
        docker push "${REGISTRY}/vayuguard-frontend:staging-latest"
        docker push "${REGISTRY}/vayuguard-backend:${IMAGE_TAG}"
        docker push "${REGISTRY}/vayuguard-backend:staging-latest"
        docker push "${REGISTRY}/vayuguard-ml-service:${IMAGE_TAG}"
        docker push "${REGISTRY}/vayuguard-ml-service:staging-latest"

        log_ok "All images pushed to registry"
    else
        log_warn "Skipping image push (--skip-push)"
    fi

    # Step 3: Stop existing services
    log_info "Step 3/5: Stopping existing staging services..."
    docker-compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" down --remove-orphans 2>/dev/null || true
    log_ok "Existing services stopped"

    # Step 4: Start services with docker-compose
    log_info "Step 4/5: Starting staging services..."
    docker-compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" up -d
    log_ok "Services started"

    # Step 5: Wait for health checks and verify
    log_info "Step 5/5: Waiting for services to become healthy..."
    local max_wait=180
    local elapsed=0
    local all_healthy=false

    while [[ $elapsed -lt $max_wait ]]; do
        local unhealthy=0

        # Check each service
        for service in backend ml-service; do
            local container="${COMPOSE_PROJECT_NAME}_${service//-/_}_1"
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
            if [[ "$health" != "healthy" ]]; then
                unhealthy=$((unhealthy + 1))
            fi
        done

        if [[ $unhealthy -eq 0 ]]; then
            all_healthy=true
            break
        fi

        echo -n "."
        sleep 10
        elapsed=$((elapsed + 10))
    done

    echo ""

    if [[ "$all_healthy" == true ]]; then
        log_ok "All services are healthy!"
    else
        log_warn "Some services may still be starting up. Check status manually."
    fi

    # Print service URLs
    log_info "========================================"
    log_info "Staging Deployment Complete!"
    log_info "========================================"
    echo ""
    echo "  Frontend:    http://localhost:3000"
    echo "  Backend API: http://localhost:5000/api/v1/health"
    echo "  ML Service:  http://localhost:8000/health"
    echo "  Grafana:     http://localhost:3001"
    echo "  Prometheus:  http://localhost:9090"
    echo ""
    echo "  Image Tag:   ${IMAGE_TAG}"
    echo ""
}

main "$@"
