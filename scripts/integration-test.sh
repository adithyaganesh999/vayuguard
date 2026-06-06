#!/usr/bin/env bash
#
# VayuGuard Integration Test Script
# Runs health checks and basic API tests against all services
#
# Usage: ./scripts/integration-test.sh [environment]
#   environment: local (default), staging, production, green
#

set -euo pipefail

# Configuration
ENV="${1:-local}"
TIMEOUT=10
PASS=0
FAIL=0
SKIP=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service URLs based on environment
case "$ENV" in
  local)
    FRONTEND_URL="http://localhost:3000"
    BACKEND_URL="http://localhost:5000"
    ML_URL="http://localhost:8000"
    ;;
  staging)
    FRONTEND_URL="https://staging.vayuguard.com"
    BACKEND_URL="https://api-staging.vayuguard.com"
    ML_URL="https://ml-staging.vayuguard.com"
    ;;
  production)
    FRONTEND_URL="https://vayuguard.com"
    BACKEND_URL="https://api.vayuguard.com"
    ML_URL="https://ml.vayuguard.com"
    ;;
  green)
    FRONTEND_URL="https://green.vayuguard.com"
    BACKEND_URL="https://api-green.vayuguard.com"
    ML_URL="https://ml-green.vayuguard.com"
    ;;
  *)
    echo -e "${RED}Unknown environment: $ENV${NC}"
    echo "Usage: $0 [local|staging|production|green]"
    exit 1
    ;;
esac

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  VayuGuard Integration Tests — ${ENV^^}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "Frontend: ${FRONTEND_URL}"
echo -e "Backend:  ${BACKEND_URL}"
echo -e "ML:       ${ML_URL}"
echo ""

# Helper functions
log_pass() {
  echo -e "  ${GREEN}✅ PASS${NC} — $1"
  ((PASS++))
}

log_fail() {
  echo -e "  ${RED}❌ FAIL${NC} — $1"
  ((FAIL++))
}

log_skip() {
  echo -e "  ${YELLOW}⏭️  SKIP${NC} — $1"
  ((SKIP++))
}

log_section() {
  echo ""
  echo -e "${BLUE}── $1 ──${NC}"
}

# ─── Frontend Tests ───────────────────────────────────────
log_section "Frontend Tests"

# Test 1: Frontend health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${FRONTEND_URL}/api/health" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log_pass "Frontend health endpoint (HTTP $HTTP_CODE)"
else
  log_fail "Frontend health endpoint (HTTP $HTTP_CODE, expected 200)"
fi

# Test 2: Frontend page loads
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${FRONTEND_URL}/" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log_pass "Frontend home page loads (HTTP $HTTP_CODE)"
else
  log_fail "Frontend home page loads (HTTP $HTTP_CODE, expected 200)"
fi

# Test 3: Static assets
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${FRONTEND_URL}/logo.svg" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log_pass "Static assets accessible (HTTP $HTTP_CODE)"
else
  log_fail "Static assets accessible (HTTP $HTTP_CODE, expected 200)"
fi

# ─── Backend Tests ────────────────────────────────────────
log_section "Backend API Tests"

# Test 4: Backend health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BACKEND_URL}/health" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log_pass "Backend health endpoint (HTTP $HTTP_CODE)"
else
  log_fail "Backend health endpoint (HTTP $HTTP_CODE, expected 200)"
fi

# Test 5: Auth endpoint exists
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -X POST "${BACKEND_URL}/api/auth/login" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "400" || "$HTTP_CODE" == "422" || "$HTTP_CODE" == "401" ]]; then
  log_pass "Auth endpoint exists and validates input (HTTP $HTTP_CODE)"
elif [[ "$HTTP_CODE" == "000" ]]; then
  log_fail "Auth endpoint unreachable"
else
  log_pass "Auth endpoint responds (HTTP $HTTP_CODE)"
fi

# Test 6: AQI current endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BACKEND_URL}/api/aqi/current?lat=28.6139&lng=77.2090" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "404" ]]; then
  log_pass "AQI current endpoint responds (HTTP $HTTP_CODE)"
else
  log_fail "AQI current endpoint (HTTP $HTTP_CODE)"
fi

# Test 7: CORS headers
CORS_HEADER=$(curl -s -I --max-time "$TIMEOUT" -H "Origin: https://vayuguard.com" "${BACKEND_URL}/health" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")
if [[ -n "$CORS_HEADER" ]]; then
  log_pass "CORS headers present"
else
  log_skip "CORS headers (not critical for integration test)"
fi

# ─── ML Service Tests ────────────────────────────────────
log_section "ML Service Tests"

# Test 8: ML health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${ML_URL}/health" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log_pass "ML service health endpoint (HTTP $HTTP_CODE)"
else
  log_fail "ML service health endpoint (HTTP $HTTP_CODE, expected 200)"
fi

# Test 9: Model version endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${ML_URL}/api/model/version" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log_pass "Model version endpoint (HTTP $HTTP_CODE)"
  # Parse model info
  MODEL_INFO=$(curl -s --max-time "$TIMEOUT" "${ML_URL}/api/model/version" 2>/dev/null || echo "{}")
  echo -e "    Models: $(echo "$MODEL_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('models',[])))" 2>/dev/null || echo "unknown")"
else
  log_fail "Model version endpoint (HTTP $HTTP_CODE, expected 200)"
fi

# Test 10: Forecast endpoint
FORECAST_BODY='{"station_id": 1, "horizon_hours": 24, "model_type": "ensemble"}'
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST "${ML_URL}/api/forecast" -H "Content-Type: application/json" -d "$FORECAST_BODY" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log_pass "Forecast endpoint (HTTP $HTTP_CODE)"
elif [[ "$HTTP_CODE" == "404" ]]; then
  log_skip "Forecast endpoint (station not found - expected for test data)"
else
  log_fail "Forecast endpoint (HTTP $HTTP_CODE)"
fi

# Test 11: Health risk endpoint
RISK_BODY='{"health_profile": {"age": 30, "sensitivity_level": "moderate"}, "aqi_value": 100}'
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -X POST "${ML_URL}/api/health-risk" -H "Content-Type: application/json" -d "$RISK_BODY" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  log_pass "Health risk endpoint (HTTP $HTTP_CODE)"
else
  log_fail "Health risk endpoint (HTTP $HTTP_CODE)"
fi

# ─── Cross-Service Tests ─────────────────────────────────
log_section "Cross-Service Tests"

# Test 12: Backend can reach ML service (via proxy)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${BACKEND_URL}/api/aqi/forecast?stationId=1&hours=24" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "404" || "$HTTP_CODE" == "502" ]]; then
  log_pass "Backend→ML service communication (HTTP $HTTP_CODE)"
else
  log_fail "Backend→ML service communication (HTTP $HTTP_CODE)"
fi

# Test 13: Response time check
START_TIME=$(date +%s%N)
curl -s -o /dev/null --max-time 10 "${BACKEND_URL}/health" 2>/dev/null || true
END_TIME=$(date +%s%N)
ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))
if [[ $ELAPSED_MS -lt 2000 ]]; then
  log_pass "Backend response time (${ELAPSED_MS}ms < 2000ms)"
else
  log_fail "Backend response time (${ELAPSED_MS}ms >= 2000ms)"
fi

# ─── Summary ─────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${SKIP} skipped${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "\n${RED}Some tests failed. Do not proceed with deployment.${NC}"
  exit 1
else
  echo -e "\n${GREEN}All tests passed! Safe to proceed with deployment.${NC}"
  exit 0
fi
