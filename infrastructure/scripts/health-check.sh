#!/usr/bin/env bash
# =============================================================================
# VayuGuard - Health Check Script
# =============================================================================
# Checks all service health endpoints and reports status.
# Can be used for monitoring, cron-based alerts, or pre-deploy verification.
# Usage: ./health-check.sh [--verbose] [--json] [--notify] [--timeout SECS]
# =============================================================================

set -euo pipefail

# ---------- Configuration ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Service endpoints (host:port:path:description)
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"
ML_SERVICE_URL="${ML_SERVICE_URL:-http://localhost:8000}"
MONGODB_URL="${MONGODB_URL:-http://localhost:27017}"
POSTGRES_URL="${POSTGRES_URL:-http://localhost:5432}"
REDIS_URL="${REDIS_URL:-http://localhost:6379}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"

CURL_TIMEOUT="${CURL_TIMEOUT:-10}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Status counters
TOTAL_SERVICES=0
HEALTHY_SERVICES=0
UNHEALTHY_SERVICES=0
DEGRADED_SERVICES=0

# Output mode
VERBOSE=false
JSON_OUTPUT=false
NOTIFY=false

# ---------- Parse Arguments ----------
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)  VERBOSE=true; shift ;;
        --json)     JSON_OUTPUT=true; shift ;;
        --notify)   NOTIFY=true; shift ;;
        --timeout)  CURL_TIMEOUT="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--verbose] [--json] [--notify] [--timeout SECS]"
            echo ""
            echo "Options:"
            echo "  --verbose       Show detailed response bodies"
            echo "  --json          Output results as JSON"
            echo "  --notify        Send notification on failure"
            echo "  --timeout SECS  Curl timeout in seconds (default: 10)"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------- Helper Functions ----------
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[✓]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[⚠]${NC}    $1"; }
log_error() { echo -e "${RED}[✗]${NC}    $1"; }

# ---------- Health Check Functions ----------
check_http_service() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"

    TOTAL_SERVICES=$((TOTAL_SERVICES + 1))

    local http_code
    http_code=$(curl -sf -o /tmp/health_response.txt -w "%{http_code}" \
        --max-time "$CURL_TIMEOUT" \
        --connect-timeout 5 \
        "$url" 2>/dev/null || echo "000")

    local response_time
    response_time=$(curl -sf -o /dev/null -w "%{time_total}" \
        --max-time "$CURL_TIMEOUT" \
        --connect-timeout 5 \
        "$url" 2>/dev/null || echo "N/A")

    if [[ "$http_code" == "$expected_status" ]]; then
        HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1))
        log_ok "${name} - OK (${http_code}) [${response_time}s]"

        if [[ "$VERBOSE" == true && -f /tmp/health_response.txt ]]; then
            local body
            body=$(head -c 500 /tmp/health_response.txt 2>/dev/null || true)
            if [[ -n "$body" ]]; then
                echo "       Response: ${body}"
            fi
        fi
    elif [[ "$http_code" == "000" ]]; then
        UNHEALTHY_SERVICES=$((UNHEALTHY_SERVICES + 1))
        log_error "${name} - UNREACHABLE (connection refused or timed out)"
    else
        DEGRADED_SERVICES=$((DEGRADED_SERVICES + 1))
        log_warn "${name} - DEGRADED (expected ${expected_status}, got ${http_code})"
    fi

    # Store result for JSON output
    HEALTH_RESULTS+=("{\"service\":\"${name}\",\"url\":\"${url}\",\"status\":\"${http_code}\",\"response_time\":\"${response_time}\"}")
}

check_tcp_service() {
    local name="$1"
    local host="$2"
    local port="$3"

    TOTAL_SERVICES=$((TOTAL_SERVICES + 1))

    if timeout "$CURL_TIMEOUT" bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null; then
        HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1))
        log_ok "${name} - OK (${host}:${port} reachable)"
    else
        UNHEALTHY_SERVICES=$((UNHEALTHY_SERVICES + 1))
        log_error "${name} - UNREACHABLE (${host}:${port})"
    fi

    HEALTH_RESULTS+=("{\"service\":\"${name}\",\"host\":\"${host}\",\"port\":\"${port}\",\"type\":\"tcp\"}")
}

check_docker_container() {
    local name="$1"

    local container_id
    container_id=$(docker ps -q -f name="$name" 2>/dev/null | head -1 || true)

    if [[ -z "$container_id" ]]; then
        log_warn "Docker container '${name}' not found (may not be running locally)"
        return
    fi

    local status
    status=$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo "unknown")

    local health
    health=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "no-healthcheck")

    local uptime
    uptime=$(docker inspect --format='{{.State.StartedAt}}' "$container_id" 2>/dev/null || echo "unknown")

    if [[ "$status" == "running" && ("$health" == "healthy" || "$health" == "no-healthcheck") ]]; then
        log_ok "Container ${name} - Running (uptime: ${uptime})"
    elif [[ "$status" == "running" && "$health" == "starting" ]]; then
        log_warn "Container ${name} - Starting up..."
    elif [[ "$status" == "running" ]]; then
        log_warn "Container ${name} - Running but ${health}"
    else
        log_error "Container ${name} - ${status}"
    fi
}

# ---------- Main Health Check ----------
main() {
    HEALTH_RESULTS=()

    log_info "=========================================="
    log_info "VayuGuard Health Check"
    log_info "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    log_info "=========================================="
    echo ""

    # ===== HTTP Health Checks =====
    log_info "--- HTTP Service Health Checks ---"

    check_http_service "Frontend"          "${FRONTEND_URL}/"                    "200"
    check_http_service "Backend API"       "${BACKEND_URL}/api/v1/health"        "200"
    check_http_service "ML Service"        "${ML_SERVICE_URL}/health"            "200"
    check_http_service "Prometheus"        "${PROMETHEUS_URL}/-/healthy"         "200"
    check_http_service "Grafana"           "${GRAFANA_URL}/api/health"           "200"

    echo ""

    # ===== TCP Health Checks =====
    log_info "--- Database & Infrastructure (TCP) ---"

    check_tcp_service "MongoDB"     "localhost" "27017"
    check_tcp_service "PostgreSQL"  "localhost" "5432"
    check_tcp_service "Redis"       "localhost" "6379"

    echo ""

    # ===== Docker Container Checks =====
    log_info "--- Docker Container Status ---"

    for container in vayuguard-frontend vayuguard-backend vayuguard-ml-service \
                     vayuguard-mongodb vayuguard-postgres vayuguard-redis \
                     vayuguard-prometheus vayuguard-grafana; do
        check_docker_container "$container"
    done

    echo ""

    # ===== API Functional Checks =====
    log_info "--- Functional API Checks ---"

    # Check backend API version endpoint
    local version
    version=$(curl -sf --max-time "$CURL_TIMEOUT" "${BACKEND_URL}/api/v1/version" 2>/dev/null || echo "unavailable")
    log_info "Backend version: ${version}"

    # Check ML model status
    local model_status
    model_status=$(curl -sf --max-time "$CURL_TIMEOUT" "${ML_SERVICE_URL}/model/status" 2>/dev/null || echo "unavailable")
    log_info "ML model status: ${model_status}"

    # Check Redis connectivity via PING
    local redis_container
    redis_container=$(docker ps -q -f name="vayuguard-redis" 2>/dev/null | head -1 || true)
    if [[ -n "$redis_container" ]]; then
        local redis_ping
        redis_ping=$(docker exec "$redis_container" redis-cli ping 2>/dev/null || echo "FAILED")
        if [[ "$redis_ping" == "PONG" ]]; then
            log_ok "Redis PING → PONG"
        else
            log_error "Redis PING → ${redis_ping}"
        fi
    fi

    echo ""

    # ===== Summary =====
    log_info "=========================================="
    log_info "Health Check Summary"
    log_info "=========================================="
    echo ""
    echo -e "  Total:     ${TOTAL_SERVICES}"
    echo -e "  Healthy:   ${GREEN}${HEALTHY_SERVICES}${NC}"
    echo -e "  Degraded:  ${YELLOW}${DEGRADED_SERVICES}${NC}"
    echo -e "  Unhealthy: ${RED}${UNHEALTHY_SERVICES}${NC}"
    echo ""

    # JSON output
    if [[ "$JSON_OUTPUT" == true ]]; then
        echo "{"
        echo "  \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
        echo "  \"total\": ${TOTAL_SERVICES},"
        echo "  \"healthy\": ${HEALTHY_SERVICES},"
        echo "  \"degraded\": ${DEGRADED_SERVICES},"
        echo "  \"unhealthy\": ${UNHEALTHY_SERVICES},"
        echo "  \"services\": [$(IFS=,; echo "${HEALTH_RESULTS[*]}")]"
        echo "}"
    fi

    # Exit with appropriate code
    if [[ $UNHEALTHY_SERVICES -gt 0 ]]; then
        log_error "Some services are unhealthy!"
        exit 1
    elif [[ $DEGRADED_SERVICES -gt 0 ]]; then
        log_warn "Some services are degraded"
        exit 2
    else
        log_ok "All services are healthy!"
        exit 0
    fi
}

main "$@"
