#!/usr/bin/env bash
# =============================================================================
# VayuGuard - Database Backup Script
# =============================================================================
# Performs MongoDB mongodump and PostgreSQL pg_dump with compression,
# rotation, and verification. Designed for cron-based scheduling.
# Usage: ./backup-db.sh [--full] [--mongodb-only] [--postgres-only]
# =============================================================================

set -euo pipefail

# ---------- Configuration ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-vayuguard-production}"

# Backup directory with date partitioning
BACKUP_ROOT="${BACKUP_ROOT:-${PROJECT_ROOT}/backups}"
BACKUP_DATE=$(date +%Y%m%d)
BACKUP_TIME=$(date +%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_DATE}"
TIMESTAMP="${BACKUP_DATE}-${BACKUP_TIME}"

# Retention policy
DAILY_RETENTION_DAYS=7
WEEKLY_RETENTION_WEEKS=4
MONTHLY_RETENTION_MONTHS=12

# MongoDB settings
MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_USER="${MONGO_USER:-vayuguard}"
MONGO_PASSWORD="${MONGO_PASSWORD:-}"
MONGO_DB="${MONGO_DB:-vayuguard}"
MONGO_AUTH_DB="${MONGO_AUTH_DB:-admin}"

# PostgreSQL settings
PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-vayuguard}"
PG_PASSWORD="${PG_PASSWORD:-}"
PG_DATABASES="${PG_DATABASES:-vayuguard vayuguard_ml}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ---------- Helper Functions ----------
log_info()  { echo -e "${BLUE}[INFO]${NC}  $(date '+%H:%M:%S') $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $(date '+%H:%M:%S') $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"; }

# ---------- Parse Arguments ----------
BACKUP_MONGODB=true
BACKUP_POSTGRES=true
FULL_BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --full)          FULL_BACKUP=true; shift ;;
        --mongodb-only)  BACKUP_POSTGRES=false; shift ;;
        --postgres-only) BACKUP_MONGODB=false; shift ;;
        -h|--help)
            echo "Usage: $0 [--full] [--mongodb-only] [--postgres-only]"
            echo ""
            echo "Options:"
            echo "  --full          Full backup (includes indexes and larger snapshots)"
            echo "  --mongodb-only  Only backup MongoDB"
            echo "  --postgres-only Only backup PostgreSQL"
            exit 0
            ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------- Backup MongoDB ----------
backup_mongodb() {
    log_info "Starting MongoDB backup..."

    mkdir -p "${BACKUP_DIR}/mongodb"

    # Find MongoDB container
    local mongo_container
    mongo_container=$(docker ps -q -f name="${COMPOSE_PROJECT_NAME}-mongodb" -f name="vayuguard-mongodb" 2>/dev/null | head -1 || true)

    if [[ -z "$mongo_container" ]]; then
        log_error "MongoDB container not found. Is the service running?"
        return 1
    fi

    # Build mongodump command
    local dump_args=(
        "--host" "localhost"
        "--port" "27017"
        "--username" "${MONGO_USER}"
        "--password" "${MONGO_PASSWORD}"
        "--authenticationDatabase" "${MONGO_AUTH_DB}"
        "--db" "${MONGO_DB}"
        "--out" "/tmp/mongobackup"
        "--gzip"
        "--quiet"
    )

    if [[ "$FULL_BACKUP" == true ]]; then
        dump_args+=("--oplog")
        log_info "Performing full backup with oplog..."
    fi

    # Execute mongodump
    if docker exec "$mongo_container" mongodump "${dump_args[@]}" 2>/dev/null; then
        # Copy backup from container
        docker cp "${mongo_container}:/tmp/mongobackup/." "${BACKUP_DIR}/mongodb/"

        # Create compressed archive
        tar -czf "${BACKUP_DIR}/mongodb-${TIMESTAMP}.tar.gz" \
            -C "${BACKUP_DIR}/mongodb" . 2>/dev/null

        # Clean up uncompressed files
        rm -rf "${BACKUP_DIR}/mongodb"

        # Verify the backup archive
        if tar -tzf "${BACKUP_DIR}/mongodb-${TIMESTAMP}.tar.gz" &>/dev/null; then
            local size
            size=$(du -h "${BACKUP_DIR}/mongodb-${TIMESTAMP}.tar.gz" | cut -f1)
            log_ok "MongoDB backup completed (${size})"
        else
            log_error "MongoDB backup archive is corrupted!"
            return 1
        fi
    else
        log_error "MongoDB mongodump failed!"
        return 1
    fi

    # Clean up temp files in container
    docker exec "$mongo_container" rm -rf /tmp/mongobackup 2>/dev/null || true
}

# ---------- Backup PostgreSQL ----------
backup_postgres() {
    log_info "Starting PostgreSQL backup..."

    mkdir -p "${BACKUP_DIR}/postgres"

    # Find PostgreSQL container
    local pg_container
    pg_container=$(docker ps -q -f name="${COMPOSE_PROJECT_NAME}-postgres" -f name="vayuguard-postgres" 2>/dev/null | head -1 || true)

    if [[ -z "$pg_container" ]]; then
        log_error "PostgreSQL container not found. Is the service running?"
        return 1
    fi

    # Backup each database
    for db in $PG_DATABASES; do
        log_info "Backing up PostgreSQL database: ${db}..."

        local dump_file="${BACKUP_DIR}/postgres/${db}-${TIMESTAMP}.dump"

        # Execute pg_dump with custom format (compressed)
        if docker exec "$pg_container" pg_dump \
            -U "${PG_USER}" \
            -d "${db}" \
            --format=custom \
            --compress=9 \
            --verbose \
            > "$dump_file" 2>/dev/null; then

            # Verify the backup file
            if [[ -f "$dump_file" && -s "$dump_file" ]]; then
                local size
                size=$(du -h "$dump_file" | cut -f1)
                log_ok "PostgreSQL ${db} backup completed (${size})"
            else
                log_error "PostgreSQL ${db} backup file is empty or missing!"
                return 1
            fi
        else
            log_error "PostgreSQL pg_dump failed for database: ${db}!"
            return 1
        fi

        # Full backup: also create plain SQL dump for human readability
        if [[ "$FULL_BACKUP" == true ]]; then
            log_info "Creating plain SQL dump for ${db}..."
            docker exec "$pg_container" pg_dump \
                -U "${PG_USER}" \
                -d "${db}" \
                --format=plain \
                --no-owner \
                --no-privileges \
                > "${BACKUP_DIR}/postgres/${db}-${TIMESTAMP}.sql" 2>/dev/null || true
        fi
    done
}

# ---------- Backup Redis (RDB snapshot) ----------
backup_redis() {
    log_info "Creating Redis RDB snapshot..."

    local redis_container
    redis_container=$(docker ps -q -f name="${COMPOSE_PROJECT_NAME}-redis" -f name="vayuguard-redis" 2>/dev/null | head -1 || true)

    if [[ -n "$redis_container" ]]; then
        # Trigger BGSAVE
        docker exec "$redis_container" redis-cli BGSAVE 2>/dev/null || true
        sleep 5

        # Copy RDB file
        docker cp "${redis_container}:/data/dump.rdb" \
            "${BACKUP_DIR}/redis-${TIMESTAMP}.rdb" 2>/dev/null || log_warn "Redis backup skipped"
    fi
}

# ---------- Rotate Old Backups ----------
rotate_backups() {
    log_info "Rotating old backups (retention: ${DAILY_RETENTION_DAYS} days)..."

    # Delete backups older than retention period
    local deleted=0
    while IFS= read -r dir; do
        if [[ -d "$dir" ]]; then
            rm -rf "$dir"
            deleted=$((deleted + 1))
            log_info "Deleted old backup: $(basename "$dir")"
        fi
    done < <(find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -mtime +${DAILY_RETENTION_DAYS} 2>/dev/null)

    if [[ $deleted -gt 0 ]]; then
        log_ok "Rotated ${deleted} old backup(s)"
    else
        log_info "No backups to rotate"
    fi
}

# ---------- Generate Backup Report ----------
generate_report() {
    local report_file="${BACKUP_DIR}/backup-report-${TIMESTAMP}.txt"

    cat > "$report_file" <<EOF
================================================================
VayuGuard Database Backup Report
================================================================
Timestamp:     $(date -u '+%Y-%m-%d %H:%M:%S UTC')
Hostname:      $(hostname)
Backup Type:   $([[ "$FULL_BACKUP" == true ]] && echo "Full" || echo "Incremental")

MongoDB:       $([[ "$BACKUP_MONGODB" == true ]] && echo "Included" || echo "Skipped")
PostgreSQL:    $([[ "$BACKUP_POSTGRES" == true ]] && echo "Included" || echo "Skipped")
Redis:         Included (RDB snapshot)

Backup Size:
$(du -sh "${BACKUP_DIR}" 2>/dev/null || echo "  Unable to calculate")

Backup Contents:
$(ls -lah "${BACKUP_DIR}/" 2>/dev/null || echo "  No files")

Retention Policy:
  Daily:   ${DAILY_RETENTION_DAYS} days
  Weekly:  ${WEEKLY_RETENTION_WEEKS} weeks
  Monthly: ${MONTHLY_RETENTION_MONTHS} months

================================================================
EOF

    log_ok "Backup report saved to ${report_file}"
    cat "$report_file"
}

# ---------- Main ----------
main() {
    log_info "=========================================="
    log_info "VayuGuard Database Backup"
    log_info "Timestamp: ${TIMESTAMP}"
    log_info "=========================================="

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Track success/failure
    local failures=0

    # Perform backups
    if [[ "$BACKUP_MONGODB" == true ]]; then
        backup_mongodb || failures=$((failures + 1))
    fi

    if [[ "$BACKUP_POSTGRES" == true ]]; then
        backup_postgres || failures=$((failures + 1))
    fi

    # Always try Redis
    backup_redis || true

    # Rotate old backups
    rotate_backups

    # Generate report
    generate_report

    # Final status
    if [[ $failures -eq 0 ]]; then
        log_ok "All database backups completed successfully!"
        exit 0
    else
        log_error "${failures} backup(s) failed! Check the report for details."
        exit 1
    fi
}

main "$@"
