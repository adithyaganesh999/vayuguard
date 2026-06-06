# VayuGuard Data Recovery Runbook

> Procedures for backing up and restoring MongoDB and PostgreSQL databases for VayuGuard.

---

## Table of Contents

1. [Backup Overview](#backup-overview)
2. [MongoDB Backup](#mongodb-backup)
3. [MongoDB Restore](#mongodb-restore)
4. [PostgreSQL Backup](#postgresql-backup)
5. [PostgreSQL Restore](#postgresql-restore)
6. [Point-in-Time Recovery](#point-in-time-recovery)
7. [Emergency Procedures](#emergency-procedures)
8. [Verification & Testing](#verification--testing)

---

## Backup Overview

### Automated Backups

| Database | Method | Schedule | Retention | Location |
|----------|--------|----------|-----------|----------|
| MongoDB | Atlas Cloud Backup | Daily at 02:00 UTC | 30 days | Atlas S3 |
| MongoDB | mongodump (manual) | On-demand | 90 days | S3://vayuguard-backups/mongodb/ |
| PostgreSQL | RDS Automated Backup | Continuous (WAL) | 35 days | RDS Internal |
| PostgreSQL | pg_dump (manual) | Daily at 03:00 UTC | 90 days | S3://vayuguard-backups/postgres/ |

### Backup Script

The automated backup script is located at: `infrastructure/scripts/backup-db.sh`

```bash
# Run manual backup
./infrastructure/scripts/backup-db.sh
```

### Backup Storage

| Storage | Region | Bucket | Encryption |
|---------|--------|--------|------------|
| AWS S3 | ap-south-1 | vayuguard-backups | AES-256 (SSE-S3) |
| Atlas | Global | Atlas managed | Atlas encryption |

---

## MongoDB Backup

### Method 1: Atlas Cloud Backup (Recommended for Production)

Atlas automated backups are enabled and configured for daily snapshots.

**Via Atlas Console:**
1. Log in to https://cloud.mongodb.com
2. Select `vayuguard-production` cluster
3. Navigate to **Cloud Backup** tab
4. Click **Take Snapshot Now** for immediate backup
5. Select retention period (default: 7 days)

**Via Atlas CLI:**
```bash
# Install Atlas CLI
npm install -g atlas-cli

# Authenticate
atlas auth login

# List clusters
atlas clusters list

# Create on-demand snapshot
atlas backups snapshots create \
  --clusterName vayuguard-production \
  --desc "Pre-migration snapshot $(date +%Y%m%d-%H%M)" \
  --retentionDays 7
```

### Method 2: mongodump (For Manual/Staging Backups)

```bash
# Full backup
mongodump \
  --uri="$MONGODB_URI" \
  --out=/backup/mongodb/$(date +%Y%m%d-%H%M%S)/ \
  --gzip \
  --numParallelCollections=4

# Specific collections only
mongodump \
  --uri="$MONGODB_URI" \
  --collection=users \
  --collection=healthprofiles \
  --collection=alertsubscriptions \
  --out=/backup/mongodb/$(date +%Y%m%d-%H%M%S)/ \
  --gzip

# Upload to S3
aws s3 sync /backup/mongodb/$(date +%Y%m%d-%H%M%S)/ \
  s3://vayuguard-backups/mongodb/$(date +%Y%m%d-%H%M%S)/
```

### Method 3: MongoDB Ops Manager Backup

For large databases (> 10GB), use Ops Manager for incremental backups:

```bash
# Via Ops Manager API
curl -X POST "https://ops-manager.vayuguard.com/api/public/v1.0/groups/{GROUP_ID}/backupConfigs/{CLUSTER_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "snapshotIntervalHours": 24,
    "snapshotRetentionDays": 30,
    "dailySnapshotRetentionDays": 30,
    "weeklySnapshotRetentionWeeks": 12,
    "monthlySnapshotRetentionMonths": 6
  }'
```

### Backup Sizing Guide

| Collection | Avg. Document Size | Document Count | Estimated Backup Size |
|-----------|-------------------|----------------|---------------------|
| users | ~1.2 KB | 50,000 | ~60 MB |
| healthprofiles | ~0.8 KB | 45,000 | ~36 MB |
| alertsubscriptions | ~0.6 KB | 80,000 | ~48 MB |
| savedlocations | ~0.5 KB | 120,000 | ~60 MB |
| notifications | ~1.5 KB | 500,000 | ~750 MB |
| **Total** | | | **~954 MB** |

---

## MongoDB Restore

### Method 1: Atlas Cloud Restore (Recommended for Production)

**Via Atlas Console:**
1. Log in to https://cloud.mongodb.com
2. Select `vayuguard-production` cluster
3. Navigate to **Cloud Backup** tab
4. Find the snapshot to restore
5. Click **Restore** → Choose restore type:
   - **Automated Restore**: Restores to a new cluster (recommended)
   - **Download**: Downloads snapshot tarball for manual restore

**Via Atlas CLI:**
```bash
# List available snapshots
atlas backups snapshots list --clusterName vayuguard-production

# Restore to a new cluster (safe method)
atlas backups restore start \
  --clusterName vayuguard-production \
  --snapshotId <snapshot-id> \
  --targetClusterName vayuguard-restored \
  --targetGroupId <group-id>

# Check restore job status
atlas backups restore list --clusterName vayuguard-production
```

### Method 2: mongorestore (For Manual/Staging Restores)

```bash
# Download from S3 if needed
aws s3 sync s3://vayuguard-backups/mongodb/20250115-020000/ /backup/mongodb/20250115-020000/

# Full restore (WARNING: overwrites existing data)
mongorestore \
  --uri="$MONGODB_URI" \
  --drop \
  --gzip \
  /backup/mongodb/20250115-020000/

# Restore specific collections only
mongorestore \
  --uri="$MONGODB_URI" \
  --drop \
  --gzip \
  --collection=users \
  --nsInclude=vayuguard.users \
  /backup/mongodb/20250115-020000/

# Restore to a different database (safe method)
mongorestore \
  --uri="$MONGODB_URI_STAGING" \
  --gzip \
  --nsFrom='vayuguard.*' \
  --nsTo='vayuguard_restore.*' \
  /backup/mongodb/20250115-020000/
```

### Method 3: Point-in-Time Restore (Atlas)

```bash
# Restore to a specific point in time (within retention window)
atlas backups restore start \
  --clusterName vayuguard-production \
  --oplogTs 1705312000 \
  --oplogInc 1 \
  --targetClusterName vayuguard-pit-restored \
  --targetGroupId <group-id>
```

**PITR Limitations:**
- Available only with Atlas M10+ clusters
- Can restore to any point within the last 72 hours
- Must restore to a new cluster

---

## PostgreSQL Backup

### Method 1: RDS Automated Backup (Production)

RDS automated backups are enabled with a 35-day retention period.

**Via AWS Console:**
1. Go to RDS → Databases → `vayuguard-postgres`
2. Click **Restore to point in time**
3. Select **Custom** restore time
4. Create new DB instance from restore

**Via AWS CLI:**
```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier vayuguard-postgres

# Restore from automated snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vayuguard-restored \
  --db-snapshot-identifier vayuguard-postgres-2025-01-15-02-00

# Point-in-time restore
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vayuguard-postgres \
  --target-db-instance-identifier vayuguard-pit-restored \
  --restore-time 2025-01-15T08:30:00Z
```

### Method 2: pg_dump (Manual/Staging)

```bash
# Full database dump
pg_dump \
  --format=custom \
  --compress=9 \
  --verbose \
  --file=/backup/postgres/vayuguard-$(date +%Y%m%d-%H%M%S).dump \
  "$POSTGRES_URI"

# Schema-only dump
pg_dump \
  --schema-only \
  --format=plain \
  --file=/backup/postgres/schema-$(date +%Y%m%d).sql \
  "$POSTGRES_URI"

# Data-only dump (for specific tables)
pg_dump \
  --data-only \
  --format=custom \
  --compress=9 \
  --table=aqi_readings \
  --table=weather_readings \
  --file=/backup/postgres/data-readings-$(date +%Y%m%d).dump \
  "$POSTGRES_URI"

# Upload to S3
aws s3 cp /backup/postgres/vayuguard-$(date +%Y%m%d-%H%M%S).dump \
  s3://vayuguard-backups/postgres/
```

### Method 3: Parallel pg_dump (Large Databases)

```bash
# Use parallel jobs for faster backup of large databases
pg_dump \
  --format=directory \
  --compress=9 \
  --jobs=4 \
  --file=/backup/postgres/parallel-$(date +%Y%m%d-%H%M%S)/ \
  "$POSTGRES_URI"
```

### Backup Sizing Guide

| Table | Row Count | Avg. Row Size | Estimated Backup Size |
|-------|-----------|---------------|---------------------|
| stations | 342 | ~500 B | ~170 KB |
| aqi_readings | 5,242,880 | ~200 B | ~1 GB |
| weather_readings | 4,500,000 | ~300 B | ~1.3 GB |
| forecasts | 500,000 | ~250 B | ~125 MB |
| alerts | 10,000 | ~1 KB | ~10 MB |
| **Total** | | | **~2.5 GB** (compressed: ~500 MB) |

---

## PostgreSQL Restore

### Method 1: RDS Restore (Production)

```bash
# 1. Restore from RDS snapshot (creates new instance)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vayuguard-restored \
  --db-snapshot-identifier vayuguard-postgres-2025-01-15-02-00

# 2. Wait for instance to be available
aws rds wait db-instance-available \
  --db-instance-identifier vayuguard-restored

# 3. Get the restored instance endpoint
aws rds describe-db-instances \
  --db-instance-identifier vayuguard-restored \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# 4. Update application to point to restored instance
# Edit Kubernetes secret with new connection string
kubectl edit secret backend-secrets -n vayuguard-production

# 5. Restart backend
kubectl rollout restart deployment/backend -n vayuguard-production

# 6. Verify data integrity
psql "$RESTORED_POSTGRES_URI" -c "SELECT COUNT(*) FROM aqi_readings;"
psql "$RESTORED_POSTGRES_URI" -c "SELECT MAX(timestamp) FROM aqi_readings;"
```

### Method 2: pg_restore (Manual/Staging)

```bash
# Download from S3 if needed
aws s3 cp s3://vayuguard-backups/postgres/vayuguard-20250115-030000.dump \
  /backup/postgres/vayuguard-20250115-030000.dump

# Full restore (WARNING: drops existing data)
pg_restore \
  --clean \
  --if-exists \
  --verbose \
  --dbname="$POSTGRES_URI" \
  /backup/postgres/vayuguard-20250115-030000.dump

# Restore to a new database (safe method)
createdb -T template0 vayuguard_restored
pg_restore \
  --verbose \
  --dbname="postgresql://user:pass@localhost:5432/vayuguard_restored" \
  /backup/postgres/vayuguard-20250115-030000.dump

# Restore specific tables only
pg_restore \
  --clean \
  --if-exists \
  --table=aqi_readings \
  --table=weather_readings \
  --dbname="$POSTGRES_URI" \
  /backup/postgres/vayuguard-20250115-030000.dump

# Parallel restore (from directory format backup)
pg_restore \
  --clean \
  --if-exists \
  --jobs=4 \
  --dbname="$POSTGRES_URI" \
  /backup/postgres/parallel-20250115-030000/
```

### Method 3: SQL Restore (Plain Text Format)

```bash
# For plain-text SQL dumps
psql "$POSTGRES_URI" < /backup/postgres/schema-20250115.sql

# With transaction (safer - rolls back on error)
psql "$POSTGRES_URI" <<EOF
BEGIN;
\i /backup/postgres/schema-20250115.sql
COMMIT;
EOF
```

---

## Point-in-Time Recovery

### PostgreSQL PITR (via RDS)

RDS supports continuous backup with point-in-time restore within the retention window (35 days).

```bash
# Restore to exact timestamp
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vayuguard-postgres \
  --target-db-instance-identifier vayuguard-pit-$(date +%Y%m%d-%H%M) \
  --restore-time "2025-01-15T08:30:00Z" \
  --db-subnet-group-name vayuguard-subnet \
  --vpc-security-group-ids sg-xxxxxxxx

# Monitor restore progress
aws rds describe-db-instances \
  --db-instance-identifier vayuguard-pit-20250115-0830 \
  --query 'DBInstances[0].DBInstanceStatus'
```

### MongoDB PITR (via Atlas)

```bash
# Atlas supports PITR for M10+ clusters
# Via Atlas CLI:
atlas backups restore start \
  --clusterName vayuguard-production \
  --pointInTimeUTCMillis 1705312200000 \
  --targetClusterName vayuguard-pit-restored

# Via Atlas Console:
# 1. Go to Cloud Backup → Restore
# 2. Select "Point in Time" restore type
# 3. Choose the exact timestamp
# 4. Select target cluster
```

---

## Emergency Procedures

### Complete Data Loss Scenario

If both primary and replica databases are lost:

```bash
# Step 1: Create new database instances
# MongoDB
atlas clusters create vayuguard-recovery \
  --tier M30 \
  --region AP_SOUTH_1 \
  --mdbVersion 7.0

# PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier vayuguard-recovery \
  --db-instance-class db.r5.large \
  --engine postgres \
  --engine-version 16.1 \
  --master-username vayuguard \
  --master-user-password <new-password> \
  --allocated-storage 500

# Step 2: Restore from latest S3 backup
# MongoDB
aws s3 sync s3://vayuguard-backups/mongodb/LATEST/ /tmp/mongo-restore/
mongorestore --uri="$NEW_MONGODB_URI" --drop --gzip /tmp/mongo-restore/

# PostgreSQL
aws s3 cp s3://vayuguard-backups/postgres/LATEST.dump /tmp/pg-restore.dump
pg_restore --clean --if-exists --dbname="$NEW_POSTGRES_URI" /tmp/pg-restore.dump

# Step 3: Update application configuration
kubectl edit secret backend-secrets -n vayuguard-production
# Update MONGODB_URI and POSTGRES_URI

# Step 4: Restart services
kubectl rollout restart deployment -n vayuguard-production

# Step 5: Verify data integrity
./scripts/integration-test.sh production
```

### Corrupted Collection Recovery

```bash
# MongoDB: Repair a specific collection
mongosh "$MONGODB_URI" --eval '
  db.users.validate();
'

# If validation fails, restore just that collection
mongorestore \
  --uri="$MONGODB_URI" \
  --drop \
  --gzip \
  --collection=users \
  --nsInclude=vayuguard.users \
  /backup/mongodb/LATEST/

# PostgreSQL: Repair a corrupted table
psql "$POSTGRES_URI" -c "REINDEX TABLE aqi_readings;"
psql "$POSTGRES_URI" -c "VACUUM FULL aqi_readings;"
```

### Accidental Data Deletion

```bash
# Step 1: IMMEDIATELY stop application writes
kubectl scale deployment/backend --replicas=0 -n vayuguard-production

# Step 2: Assess the damage
psql "$POSTGRES_URI" -c "SELECT COUNT(*) FROM aqi_readings;"
mongosh "$MONGODB_URI" --eval 'db.users.countDocuments()'

# Step 3: Determine the deletion timestamp
# Check application logs for DELETE operations
kubectl logs -l app=backend -n vayuguard-production | rg "DELETE"

# Step 4: Restore from PITR to just before the deletion
# (See Point-in-Time Recovery section)

# Step 5: Extract only the deleted data from the restored instance
# Export deleted data
pg_dump \
  --data-only \
  --table=users \
  --dbname="$RESTORED_URI" \
  > /tmp/deleted-users.sql

# Import into production
psql "$POSTGRES_URI" < /tmp/deleted-users.sql

# Step 6: Resume application
kubectl scale deployment/backend --replicas=3 -n vayuguard-production
```

---

## Verification & Testing

### Post-Restore Verification

After any restore operation, run these verification checks:

```bash
#!/bin/bash
echo "=== Post-Restore Verification ==="

# MongoDB checks
echo "--- MongoDB ---"
mongosh "$MONGODB_URI" --eval '
  print("Collections:");
  db.getCollectionNames().forEach(c => {
    print("  " + c + ": " + db[c].countDocuments() + " documents");
  });
  print("Users with health profiles:");
  db.users.aggregate([
    { $lookup: { from: "healthprofiles", localField: "_id", foreignField: "userId", as: "profile" } },
    { $match: { profile: { $ne: [] } } },
    { $count: "withProfile" }
  ]);
'

# PostgreSQL checks
echo "--- PostgreSQL ---"
psql "$POSTGRES_URI" <<EOF
  SELECT 'stations' as table_name, COUNT(*) as row_count FROM stations
  UNION ALL SELECT 'aqi_readings', COUNT(*) FROM aqi_readings
  UNION ALL SELECT 'weather_readings', COUNT(*) FROM weather_readings
  UNION ALL SELECT 'forecasts', COUNT(*) FROM forecasts
  UNION ALL SELECT 'alerts', COUNT(*) FROM alerts;
  
  SELECT 'Data freshness (latest AQI reading):' as info, MAX(timestamp) as latest FROM aqi_readings;
  SELECT 'Data date range:' as info, MIN(timestamp) as earliest, MAX(timestamp) as latest FROM aqi_readings;
EOF

# Application checks
echo "--- Application ---"
curl -sf http://localhost:5000/health | jq .
curl -sf http://localhost:8000/health | jq .

echo "=== Verification Complete ==="
```

### Monthly Backup Testing

Run this monthly to ensure backups are restorable:

```bash
#!/bin/bash
# Monthly backup verification script
# Run on the first Monday of each month

STAGING_MONGO="mongodb://staging:pass@staging-host:27017/vayuguard_test"
STAGING_PG="postgresql://staging:pass@staging-host:5432/vayuguard_test"

# 1. Download latest backups
LATEST_MONGO=$(aws s3 ls s3://vayuguard-backups/mongodb/ | tail -1 | awk '{print $2}')
aws s3 sync "s3://vayuguard-backups/mongodb/$LATEST_MONGO" /tmp/backup-test/mongo/

LATEST_PG=$(aws s3 ls s3://vayuguard-backups/postgres/ | tail -1 | awk '{print $4}')
aws s3 cp "s3://vayuguard-backups/postgres/$LATEST_PG" /tmp/backup-test/postgres.dump

# 2. Restore to staging
mongorestore --uri="$STAGING_MONGO" --drop --gzip /tmp/backup-test/mongo/
pg_restore --clean --if-exists --dbname="$STAGING_PG" /tmp/backup-test/postgres.dump

# 3. Verify
mongosh "$STAGING_MONGO" --eval 'db.users.countDocuments()'
psql "$STAGING_PG" -c "SELECT COUNT(*) FROM aqi_readings;"

# 4. Report
echo "Backup test completed: $(date)" >> /var/log/backup-tests.log
```
