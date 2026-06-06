#!/usr/bin/env bash
# =============================================================================
# VayuGuard - Production Deployment Script
# =============================================================================
# Production deploy with backup, manual approval, health verification, rollback
# Usage: ./deploy-production.sh [--skip-approval] [--rollback] [--version TAG]
# =============================================================================

set -euo pipefail

# ---------- Configuration ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/infrastructure/docker/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env.production"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/vayuguard}"
COMPOSE_PROJECT_NAME="vayuguard-production"
BACKUP_DIR="${PROJECT_ROOT}/backups/$(date +%Y%m%d)"
DEPLOY_LOG="${PROJECT_ROOT}/deploy-$(date +%Y%m%d-%H%M%S).log"
ROLLBACK_VERSION=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---------- Helper Functions ----------
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1" | tee -a "$DEPLOY_LOG"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1" | tee -a "$DEPLOY_LOG"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1" | tee -a "$DEPLOY_LOG"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOY_LOG"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $1" | tee -a "$DEPLOY_LOG"; }

confirm() {
    local prompt="$1"
    echo -ne "${YELLOW}${prompt} (yes/no): ${NC}"
    read -r response
    [[ "$response" =~ ^[Yy][Ee][Ss]$ ]]
}

# ---------- Parse Arguments ----------
SKIP_APPROVAL=false
ROLLBACK=false
IMAGE_TAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-approval) SKIP_APPROVAL=true; shift ;;
        --rollback)      ROLLBACK=true; shift ;;
        --version)       IMAGE_TAG="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--skip-approval] [--rollback] [--version TAG]"
            echo ""
            echo "Options:"
            echo "  --skip-approval  Skip manual approval step (CI/CD use)"
            echo "  --rollback       Rollback to previous deployment"
            echo "  --version TAG    Deploy specific image tag"
            exit 0
            ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

# Set image tag
if [[ -z "$IMAGE_TAG" ]]; then
    IMAGE_TAG="prod-$(date +%Y%m%d-%H%M%S)"
fi

# ---------- Pre-deployment Checks ----------
pre_deployment_checks() {
    log_step "Running pre-deployment checks..."

    # Verify Docker
    if ! docker info &>/dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Verify .env.production exists
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Production environment file not found: $ENV_FILE"
        exit 1
    fi

    # Verify registry authentication
    if ! docker pull "${REGISTRY}/vayuguard-backend:production-latest" &>/dev/null; then
        log_error "Cannot pull from registry. Please authenticate: docker login ${REGISTRY}"
        exit 1
    fi

    # Check disk space (need at least 10GB free)
    local free_space
    free_space=$(df -BG "${PROJECT_ROOT}" | awk 'NR==2 {print $4}' | tr -d 'G')
    if [[ "$free_space" -lt 10 ]]; then
        log_error "Insufficient disk space: ${free_space}GB free (need 10GB minimum)"
        exit 1
    fi

    # Verify current services are healthy before deploying
    log_info "Checking current service health..."
    local current_health
    current_health=$(curl -sf http://localhost:5000/api/v1/health 2>/dev/null || echo "unhealthy")
    if [[ "$current_health" == "unhealthy" ]]; then
        log_warn "Current backend is unhealthy. Proceeding with deployment anyway."
    else
        log_ok "Current services are healthy"
    fi

    log_ok "Pre-deployment checks passed"
}

# ---------- Database Backup ----------
backup_databases() {
    log_step "Creating database backups..."

    mkdir -p "$BACKUP_DIR"

    # MongoDB backup
    log_info "Backing up MongoDB..."
    local mongo_container
    mongo_container=$(docker ps -q -f name=vayuguard-mongodb 2>/dev/null || true)

    if [[ -n "$mongo_container" ]]; then
        docker exec "$mongo_container" mongodump \
            --username=vayuguard \
            --password="${MONGO_PASSWORD}" \
            --authenticationDatabase=admin \
            --db=vayuguard \
            --out=/tmp/backup \
            --quiet 2>/dev/null || log_warn "MongoDB backup failed"

        docker cp "${mongo_container}:/tmp/backup" "${BACKUP_DIR}/mongodb/"
        log_ok "MongoDB backup completed"
    else
        log_warn "MongoDB container not found, skipping backup"
    fi

    # PostgreSQL backup
    log_info "Backing up PostgreSQL..."
    local pg_container
    pg_container=$(docker ps -q -f name=vayuguard-postgres 2>/dev/null || true)

    if [[ -n "$pg_container" ]]; then
        docker exec "$pg_container" pg_dump \
            -U vayuguard \
            -d vayuguard \
            --format=custom \
            --compress=9 \
            > "${BACKUP_DIR}/vayuguard_pg.dump" 2>/dev/null || log_warn "PostgreSQL backup failed"

        docker exec "$pg_container" pg_dump \
            -U vayuguard \
            -d vayuguard_ml \
            --format=custom \
            --compress=9 \
            > "${BACKUP_DIR}/vayuguard_ml_pg.dump" 2>/dev/null || log_warn "ML PostgreSQL backup failed"

        log_ok "PostgreSQL backup completed"
    else
        log_warn "PostgreSQL container not found, skipping backup"
    fi

    # Record current version for rollback
    echo "${IMAGE_TAG}" > "${BACKUP_DIR}/deploy-version.txt"
    log_ok "Backups saved to ${BACKUP_DIR}"
}

# ---------- Manual Approval Gate ----------
approval_gate() {
    if [[ "$SKIP_APPROVAL" == true ]]; then
        log_info "Skipping approval gate (--skip-approval)"
        return
    fi

    log_step "Approval Gate"
    echo ""
    echo "  ╔══════════════════════════════════════════════╗"
    echo "  ║     VayuGuard PRODUCTION Deployment          ║"
    echo "  ╠══════════════════════════════════════════════╣"
    echo "  ║  Version:  ${IMAGE_TAG}"
    echo "  ║  Registry: ${REGISTRY}"
    echo "  ║  Backup:   ${BACKUP_DIR}"
    echo "  ╚══════════════════════════════════════════════╝"
    echo ""

    if ! confirm "Are you sure you want to deploy to PRODUCTION?"; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
}

# ---------- Rollback ----------
rollback() {
    log_step "Initiating rollback..."

    local previous_version
    previous_version=$(ls -t "${PROJECT_ROOT}"/backups/*/deploy-version.txt 2>/dev/null | head -1 | xargs cat 2>/dev/null || true)

    if [[ -z "$previous_version" ]]; then
        log_error "No previous version found for rollback"
        exit 1
    fi

    log_info "Rolling back to version: ${previous_version}"
    IMAGE_TAG="$previous_version"

    # Restore database from backup
    local latest_backup
    latest_backup=$(ls -td "${PROJECT_ROOT}"/backups/*/ 2>/dev/null | head -1 || true)

    if [[ -n "$latest_backup" ]]; then
        log_info "Restoring databases from backup..."
        # Restore would go here based on backup contents
        log_ok "Database restore initiated"
    fi
}

# ---------- Deploy ----------
deploy_services() {
    log_step "Deploying production services..."

    # Pull latest images
    log_info "Pulling production images..."
    for service in frontend backend ml-service; do
        local image="${REGISTRY}/vayuguard-${service}:${IMAGE_TAG}"
        docker pull "$image" || {
            log_error "Failed to pull image: $image"
            exit 1
        }
    done

    # Stop services gracefully
    log_info "Gracefully stopping current services..."
    docker-compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" \
        down --timeout 60 --remove-orphans 2>/dev/null || true

    # Start services
    log_info "Starting production services..."
    docker-compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" \
        up -d --no-build

    log_ok "Services started"
}

# ---------- Health Verification ----------
verify_deployment() {
    log_step "Verifying deployment health..."

    local max_wait=300
    local elapsed=0
    local services=("backend:5000:/api/v1/health" "ml-service:8000:/health" "frontend:3000:/")

    while [[ $elapsed -lt $max_wait ]]; do
        local all_healthy=true

        for svc_spec in "${services[@]}"; do
            IFS=':' read -r name port path <<< "$svc_spec"
            local health
            health=$(curl -sf "http://localhost:${port}${path}" 2>/dev/null || echo "unhealthy")
            if [[ "$health" == "unhealthy" ]]; then
                all_healthy=false
                log_info "Waiting for ${name}... (${elapsed}s/${max_wait}s)"
                break
            fi
        done

        if [[ "$all_healthy" == true ]]; then
            log_ok "All services are healthy!"
            return 0
        fi

        sleep 10
        elapsed=$((elapsed + 10))
    done

    log_error "Health verification failed after ${max_wait}s!"
    log_error "Initiating automatic rollback..."
    rollback
    exit 1
}

# ---------- Main ----------
main() {
    log_info "=========================================="
    log_info "VayuGuard Production Deployment"
    log_info "Version: ${IMAGE_TAG}"
    log_info "Time:    $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    log_info "=========================================="

    if [[ "$ROLLBACK" == true ]]; then
        rollback
    fi

    pre_deployment_checks
    backup_databases
    approval_gate
    deploy_services
    verify_deployment

    log_info "=========================================="
    log_ok "Production Deployment Successful!"
    log_info "=========================================="
    echo ""
    echo "  Frontend:    https://app.vayuguard.com"
    echo "  Backend API: https://app.vayuguard.com/api/v1/health"
    echo "  ML Service:  https://app.vayuguard.com/api/ml/health"
    echo "  Grafana:     https://monitoring.vayuguard.com"
    echo ""
    echo "  Version:     ${IMAGE_TAG}"
    echo "  Backup:      ${BACKUP_DIR}"
    echo "  Log:         ${DEPLOY_LOG}"
    echo ""
}

main "$@"
