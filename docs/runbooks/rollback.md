# VayuGuard Rollback Runbook

> Step-by-step rollback procedures for each VayuGuard service, including frontend, backend, ML service, and database.

---

## Table of Contents

1. [General Rollback Guidelines](#general-rollback-guidelines)
2. [Frontend Rollback](#frontend-rollback)
3. [Backend Rollback](#backend-rollback)
4. [ML Service Rollback](#ml-service-rollback)
5. [Data Pipeline Rollback](#data-pipeline-rollback)
6. [Database Migration Rollback](#database-migration-rollback)
7. [Full System Rollback](#full-system-rollback)
8. [Post-Rollback Verification](#post-rollback-verification)

---

## General Rollback Guidelines

### When to Rollback

- **Deploy causes SEV1/SEV2 incident**: Rollback immediately, investigate later
- **Deploy causes SEV3 incident**: Attempt hotfix first (30 min), then rollback if unresolved
- **Deploy causes test failures**: Fix forward if simple, rollback if complex
- **Data corruption detected**: Rollback + restore from backup

### Rollback Decision Framework

```
Is the service completely down? ──── YES ──── Rollback immediately
         │
         NO
         │
Is the issue affecting > 25% of users? ── YES ── Can you hotfix in 30 min?
         │                                      │              │
         NO                                    NO             YES
         │                                      │              │
Is data integrity at risk? ── YES ── Rollback + restore    Fix forward
         │
         NO
         │
Can you fix in < 2 hours? ── YES ── Fix forward
         │
         NO
         │
     Rollback
```

### Pre-Rollback Checklist

- [ ] Confirm the issue is caused by the recent deployment (not an external factor)
- [ ] Notify `#incidents` Slack channel
- [ ] Check if rollback will cause data inconsistency
- [ ] Ensure you have kubectl access to the correct cluster
- [ ] Know the previous working version/revision number

---

## Frontend Rollback

### Quick Rollback (Previous Version)

```bash
# 1. Check current status
kubectl get pods -n vayuguard-production -l app=frontend
kubectl rollout history deployment/frontend -n vayuguard-production

# 2. Rollback to previous version
kubectl rollout undo deployment/frontend -n vayuguard-production

# 3. Monitor rollout
kubectl rollout status deployment/frontend -n vayuguard-production --timeout=120s

# 4. Verify
curl -f https://vayuguard.com/ -o /dev/null -w "%{http_code}\n"
curl -f https://vayuguard.com/api/health
```

**Expected time**: 30-60 seconds

### Rollback to Specific Version

```bash
# 1. List rollout history
kubectl rollout history deployment/frontend -n vayuguard-production

# 2. Find the revision you want
# Look for the revision number associated with the stable version

# 3. Rollback to specific revision
kubectl rollout undo deployment/frontend -n vayuguard-production --to-revision=5

# 4. Verify
kubectl rollout status deployment/frontend -n vayuguard-production
curl -f https://vayuguard.com/api/health
```

### Image Tag Rollback

```bash
# 1. Set the image to a known-good tag
kubectl set image deployment/frontend frontend=vayuguard/frontend:v1.2.3 \
  -n vayuguard-production

# 2. Monitor rollout
kubectl rollout status deployment/frontend -n vayuguard-production

# 3. Verify
curl -f https://vayuguard.com/api/health
```

### If Rollback Fails

```bash
# Check pod events for errors
kubectl describe pods -l app=frontend -n vayuguard-production

# If image pull error, verify the tag exists
docker pull vayuguard/frontend:v1.2.3

# If CrashLoopBackOff, check logs
kubectl logs -l app=frontend -n vayuguard-production --previous

# Nuclear option: delete and redeploy from Helm
helm rollback vayuguard [REVISION] -n vayuguard-production
```

---

## Backend Rollback

### Quick Rollback

```bash
# 1. Check current status
kubectl get pods -n vayuguard-production -l app=backend

# 2. Rollback
kubectl rollout undo deployment/backend -n vayuguard-production

# 3. Monitor
kubectl rollout status deployment/backend -n vayuguard-production --timeout=120s

# 4. Verify
curl -f https://api.vayuguard.com/health
curl -f https://api.vayuguard.com/api/aqi/current?stationId=DL_ITO
```

**Expected time**: 30-60 seconds

### Rollback with Database Considerations

> ⚠️ **WARNING**: If the deployment included database migrations, rollback may require database changes too.

```bash
# 1. Check if migrations were part of this deployment
kubectl logs -l app=backend -n vayuguard-production | rg "migration"

# 2. If no migrations: safe to rollback
kubectl rollout undo deployment/backend -n vayuguard-production

# 3. If migrations were applied:
#    a) Rollback the application first
kubectl rollout undo deployment/backend -n vayuguard-production
#    b) Then rollback the migration (see Database Migration Rollback section)
```

### Backend Config Rollback

```bash
# If the issue is a config change (environment variable, secret)
# 1. Check current config
kubectl get configmap backend-config -n vayuguard-production -o yaml
kubectl get secret backend-secrets -n vayuguard-production -o yaml

# 2. Edit and revert
kubectl edit configmap backend-config -n vayuguard-production
kubectl edit secret backend-secrets -n vayuguard-production

# 3. Restart to pick up changes
kubectl rollout restart deployment/backend -n vayuguard-production
```

---

## ML Service Rollback

### Container-Level Rollback

```bash
# 1. Check current status
kubectl get pods -n vayuguard-production -l app=ml-service
kubectl rollout history deployment/ml-service -n vayuguard-production

# 2. Rollback to previous container version
kubectl rollout undo deployment/ml-service -n vayuguard-production

# 3. Monitor
kubectl rollout status deployment/ml-service -n vayuguard-production --timeout=180s

# 4. Verify model loading
curl -f http://localhost:8000/health
curl http://localhost:8000/api/model/version
```

**Expected time**: 1-3 minutes (model loading time)

### Model-Only Rollback (No Container Change)

If the container is fine but the model performance degraded after a model update:

```bash
# 1. Check current model versions
curl http://localhost:8000/api/model/version

# 2. Reload previous model version
curl -X POST http://localhost:8000/api/model/reload \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "model_type": "ensemble",
    "model_version": "3.0.0",
    "force": true
  }'

# 3. Verify
curl http://localhost:8000/api/model/version

# 4. Test with sample request
curl -X POST http://localhost:8000/api/forecast \
  -H "Content-Type: application/json" \
  -d '{"station_id": 42, "horizon_hours": 24, "model_type": "ensemble"}'
```

**Expected time**: 2-5 minutes

### Available Model Versions

| Model Type | Current Version | Previous Versions (Available) |
|------------|----------------|-------------------------------|
| LSTM | 2.3.1 | 2.3.0, 2.2.0, 2.1.0 |
| XGBoost | 1.8.0 | 1.7.0, 1.6.0 |
| Prophet | 1.2.0 | 1.1.0, 1.0.0 |
| Ensemble | 3.1.0 | 3.0.0, 2.9.0 |

Model versions are stored in MLflow. Retention: 90 days.

```bash
# List available models in MLflow
mlflow models list --registry

# Download a specific model version
mlflow artifacts download --run-id <run-id> --dst-path /tmp/model
```

---

## Data Pipeline Rollback

### Pipeline Code Rollback

```bash
# 1. Check current cron job status
kubectl get cronjobs -n vayuguard-production

# 2. Suspend the pipeline during rollback
kubectl patch cronjob data-pipeline -n vayuguard-production \
  -p '{"spec":{"suspend":true}}'

# 3. Rollback the deployment
kubectl rollout undo deployment/data-pipeline -n vayuguard-production

# 4. Verify the rollback
kubectl rollout status deployment/data-pipeline -n vayuguard-production

# 5. Resume the pipeline
kubectl patch cronjob data-pipeline -n vayuguard-production \
  -p '{"spec":{"suspend":false}}'

# 6. Trigger a manual run to verify
kubectl create job --from=cronjob/data-pipeline test-rollback -n vayuguard-production

# 7. Check data freshness after run
psql $POSTGRES_URI -c \
  "SELECT source, MAX(timestamp) as latest FROM aqi_readings GROUP BY source;"
```

### dbt Model Rollback

```bash
# 1. Identify the problematic dbt run
cd data-pipeline/transformation/dbt

# 2. Check dbt run history
dbt list --resource-type model --select state:modified

# 3. Revert to previous dbt commit
git log --oneline -10  # find the previous working commit
git checkout <commit-hash> -- transformation/dbt/

# 4. Re-run dbt
dbt run --target production --full-refresh

# 5. Verify data integrity
dbt test --target production
```

---

## Database Migration Rollback

### PostgreSQL Migration Rollback

```bash
# 1. Check which migrations have been applied
psql $POSTGRES_URI -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 10;"

# 2. Identify the migration to roll back
# Migrations are in: data-pipeline/sql/migrations/

# 3. For each migration, a rollback SQL should exist
# If not, write one carefully

# 4. Apply rollback (EXAMPLE - adjust for actual migration)
psql $POSTGRES_URI <<EOF
BEGIN;
-- Reverse the migration
ALTER TABLE alerts DROP COLUMN IF EXISTS new_column;
DELETE FROM schema_migrations WHERE version = '002';
COMMIT;
EOF

# 5. Verify
psql $POSTGRES_URI -c "\dt"  -- list tables
psql $POSTGRES_URI -c "\d alerts"  -- describe table
```

### MongoDB Migration Rollback

```bash
# 1. Check current collection schemas
mongosh "$MONGODB_URI" --eval "db.getCollectionNames()"

# 2. If using mongoose, check migration state
# VayuGuard uses mongoose schemas (auto-migration)

# 3. To revert a schema change:
mongosh "$MONGODB_URI" <<EOF
// Remove added fields
db.users.updateMany({}, { \$unset: { newField: "" } });

// Or restore from backup (if data was deleted)
// See data-recovery.md
EOF
```

---

## Full System Rollback

Use only when multiple services are affected and individual rollbacks are insufficient.

```bash
# 1. Notify team
# Post in #incidents: "Initiating full system rollback to [VERSION]"

# 2. Helm rollback (all services at once)
helm history vayuguard -n vayuguard-production
# Find the revision number for the last known-good state

helm rollback vayuguard [REVISION] -n vayuguard-production

# 3. Monitor all deployments
kubectl rollout status deployment -n vayuguard-production --timeout=300s

# 4. Verify all health endpoints
curl -f https://vayuguard.com/api/health
curl -f https://api.vayuguard.com/health
curl -f https://ml.vayuguard.com/health

# 5. Run integration tests
./scripts/integration-test.sh production

# 6. Monitor for 15 minutes
watch -n 30 'kubectl get pods -n vayuguard-production'
```

**Expected time**: 5-10 minutes

---

## Post-Rollback Verification

### Automated Checks

```bash
#!/bin/bash
echo "=== Post-Rollback Verification ==="

# 1. Frontend health
echo -n "Frontend: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://vayuguard.com/)
[[ "$HTTP_CODE" == "200" ]] && echo "✅ OK ($HTTP_CODE)" || echo "❌ FAIL ($HTTP_CODE)"

# 2. Backend health
echo -n "Backend: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.vayuguard.com/health)
[[ "$HTTP_CODE" == "200" ]] && echo "✅ OK ($HTTP_CODE)" || echo "❌ FAIL ($HTTP_CODE)"

# 3. ML service health
echo -n "ML Service: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://ml.vayuguard.com/health)
[[ "$HTTP_CODE" == "200" ]] && echo "✅ OK ($HTTP_CODE)" || echo "❌ FAIL ($HTTP_CODE)"

# 4. Model loaded
echo -n "ML Models: "
MODEL_STATUS=$(curl -s https://ml.vayuguard.com/api/model/version | jq '.models | all(.status == "production")')
[[ "$MODEL_STATUS" == "true" ]] && echo "✅ OK" || echo "❌ FAIL"

# 5. Data freshness
echo -n "Data Freshness: "
AGE=$(psql $POSTGRES_URI -t -c "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(timestamp)))/60 FROM aqi_readings;")
[[ $AGE -lt 120 ]] && echo "✅ OK (${AGE%.*} min ago)" || echo "❌ STALE (${AGE%.*} min ago)"

# 6. Pod health
echo -n "K8s Pods: "
RESTARTS=$(kubectl get pods -n vayuguard-production -o json | jq '[.items[].status.containerStatuses[].restartCount] | add')
[[ $RESTARTS -lt 5 ]] && echo "✅ OK (${RESTARTS} total restarts)" || echo "⚠️  WARNING (${RESTARTS} total restarts)"

echo "=== Verification Complete ==="
```

### Manual Checks

- [ ] Login works (user + admin)
- [ ] Dashboard loads with current AQI data
- [ ] Map displays station markers
- [ ] Forecast generates successfully
- [ ] Alert subscription CRUD works
- [ ] Health risk assessment returns valid results
- [ ] Grafana dashboards show normal metrics
- [ ] No new error spikes in logs

### Post-Rollback Actions

1. Document the rollback in the incident channel
2. Create a JIRA ticket for the root cause
3. Identify what went wrong with the deployment
4. Add tests to prevent the issue from recurring
5. Update this runbook if needed
6. Schedule post-incident review (SEV1/SEV2)
