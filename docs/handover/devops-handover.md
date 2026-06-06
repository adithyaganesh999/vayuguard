# VayuGuard DevOps Handover Document

> Infrastructure overview, deployment procedures, rollback steps, and monitoring setup for VayuGuard.

---

## Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [Deployment Procedures](#deployment-procedures)
3. [Rollback Procedures](#rollback-procedures)
4. [Monitoring Setup](#monitoring-setup)
5. [Environment Configuration](#environment-configuration)
6. [Disaster Recovery](#disaster-recovery)
7. [Security](#security)
8. [Useful Commands](#useful-commands)

---

## Infrastructure Overview

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS / Cloud Provider                     │
│                                                                  │
│  ┌──────────────┐                                               │
│  │  Route 53    │  DNS + SSL Certificate                        │
│  └──────┬───────┘                                               │
│         │                                                        │
│  ┌──────▼───────┐                                               │
│  │    nginx     │  Reverse Proxy + Load Balancer                │
│  │  (Ingress)   │  SSL Termination, Rate Limiting               │
│  └──┬───┬───┬───┘                                               │
│     │   │   │                                                    │
│  ┌──▼─┐┌▼──┐┌▼────┐                                            │
│  │FE  ││BE ││ML   │  Kubernetes Pods                            │
│  │3rep││3rep││2rep │                                            │
│  └────┘└──┬─┘└──┬──┘                                            │
│           │      │                                               │
│  ┌────────▼─┐ ┌──▼──────┐                                      │
│  │ MongoDB  │ │MLflow/S3│  Persistent Storage                   │
│  │ Atlas    │ │ Models  │                                       │
│  └──────────┘ └─────────┘                                       │
│           │                                                      │
│  ┌────────▼─┐ ┌──────────┐ ┌──────────┐                        │
│  │PostgreSQL│ │Redis     │ │Prometheus│  Supporting Services    │
│  │ RDS      │ │ElastiCache│ │+Grafana │                         │
│  └──────────┘ └──────────┘ └──────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### Kubernetes Cluster

| Resource | Specification |
|----------|--------------|
| **Cluster** | EKS (AWS) / GKE |
| **Node Pool** | 3 nodes (t3.xlarge / e2-standard-4) |
| **Kubernetes Version** | 1.28 |
| **Namespace** | `vayuguard-production`, `vayuguard-staging` |

### Service Specifications

| Service | Replicas | CPU Request | CPU Limit | Memory Request | Memory Limit | Port |
|---------|----------|-------------|-----------|----------------|-------------|------|
| Frontend (Next.js) | 3 | 250m | 500m | 256Mi | 512Mi | 3000 |
| Backend (Express) | 3 | 500m | 1000m | 512Mi | 1Gi | 5000 |
| ML Service (FastAPI) | 2 | 1000m | 2000m | 2Gi | 4Gi | 8000 |
| Data Pipeline | 1 (cron) | 500m | 1000m | 1Gi | 2Gi | - |

### Database Specifications

| Database | Type | Instance | Storage | Backup |
|----------|------|----------|---------|--------|
| MongoDB | Atlas M30 | 4 vCPU / 8GB RAM | 100GB | Daily snapshot, 30-day retention |
| PostgreSQL | RDS db.r5.large | 2 vCPU / 16GB RAM | 500GB | Daily automated, 35-day retention |
| Redis | ElastiCache cache.t3.medium | 2 vCPU / 3.37GB RAM | - | Not persisted (cache only) |

---

## Deployment Procedures

### Prerequisites

- `kubectl` configured with cluster context
- `docker` installed and authenticated with container registry
- `helm` v3+ installed
- Access to CI/CD pipeline (GitHub Actions)
- Environment variables set (see `.env.staging` / `.env.production`)

### Staging Deployment

Triggered automatically on push to `develop` branch.

**Manual deployment:**

```bash
# 1. Set context
kubectl config use-context staging-cluster

# 2. Build and push images
docker build -t vayuguard/frontend:staging -f infrastructure/docker/Dockerfile.mern-frontend .
docker push vayuguard/frontend:staging

docker build -t vayuguard/backend:staging -f infrastructure/docker/Dockerfile.mern-backend ./mern-backend
docker push vayuguard/backend:staging

docker build -t vayuguard/ml-service:staging -f ml-service/Dockerfile.ml ./ml-service
docker push vayuguard/ml-service:staging

# 3. Deploy with Helm
helm upgrade --install vayuguard ./infrastructure/helm/vayuguard \
  --namespace vayuguard-staging \
  --values ./infrastructure/helm/values-staging.yaml \
  --set frontend.image.tag=staging \
  --set backend.image.tag=staging \
  --set mlService.image.tag=staging

# 4. Verify deployment
kubectl rollout status deployment/frontend -n vayuguard-staging
kubectl rollout status deployment/backend -n vayuguard-staging
kubectl rollout status deployment/ml-service -n vayuguard-staging

# 5. Run smoke tests
./scripts/integration-test.sh staging
```

### Production Deployment

Triggered on release tag (e.g., `v1.2.3`). Requires manual approval.

**Manual deployment:**

```bash
# 1. Set context
kubectl config use-context production-cluster

# 2. Deploy with Helm (using release tag)
helm upgrade --install vayuguard ./infrastructure/helm/vayuguard \
  --namespace vayuguard-production \
  --values ./infrastructure/helm/values-production.yaml \
  --set frontend.image.tag=v1.2.3 \
  --set backend.image.tag=v1.2.3 \
  --set mlService.image.tag=v1.2.3

# 3. Monitor rollout
kubectl rollout status deployment/frontend -n vayuguard-production --timeout=300s
kubectl rollout status deployment/backend -n vayuguard-production --timeout=300s
kubectl rollout status deployment/ml-service -n vayuguard-production --timeout=300s

# 4. Verify health endpoints
curl -f https://vayuguard.com/api/health || echo "FAILED"
curl -f https://api.vayuguard.com/health || echo "FAILED"
curl -f https://ml.vayuguard.com/health || echo "FAILED"

# 5. Run integration tests
./scripts/integration-test.sh production

# 6. Monitor for 15 minutes
watch -n 30 'kubectl get pods -n vayuguard-production'
```

### Blue-Green Deployment (Zero Downtime)

For critical production updates:

```bash
# 1. Deploy to green namespace
helm upgrade --install vayuguard-green ./infrastructure/helm/vayuguard \
  --namespace vayuguard-green \
  --values ./infrastructure/helm/values-production.yaml \
  --set frontend.image.tag=v1.3.0

# 2. Test green deployment
./scripts/integration-test.sh green

# 3. Switch traffic (update nginx upstream)
kubectl patch configmap nginx-config -n vayuguard-production \
  --type merge -p '{"data":{"upstream":"vayuguard-green"}}'

# 4. Monitor for issues (5-15 minutes)
# If issues detected, switch back immediately:
# kubectl patch configmap nginx-config -n vayuguard-production \
#   --type merge -p '{"data":{"upstream":"vayuguard-production"}}'

# 5. If stable, remove old deployment
helm uninstall vayuguard -n vayuguard-production
# Rename green to production
helm upgrade --install vayuguard ./infrastructure/helm/vayuguard \
  --namespace vayuguard-production ...
```

---

## Rollback Procedures

### Frontend Rollback

```bash
# Check rollout history
kubectl rollout history deployment/frontend -n vayuguard-production

# Rollback to previous version
kubectl rollout undo deployment/frontend -n vayuguard-production

# Rollback to specific revision
kubectl rollout undo deployment/frontend -n vayuguard-production --to-revision=3

# Verify
kubectl rollout status deployment/frontend -n vayuguard-production
curl -f https://vayuguard.com/api/health
```

**Rollback time**: < 30 seconds

### Backend Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n vayuguard-production

# Verify
kubectl rollout status deployment/backend -n vayuguard-production
curl -f https://api.vayuguard.com/health
```

**Rollback time**: < 30 seconds

### ML Service Rollback

```bash
# Option 1: Kubernetes rollback (to previous container image)
kubectl rollout undo deployment/ml-service -n vayuguard-production

# Option 2: Model-only rollback (keep same container, load previous model)
curl -X POST https://ml.vayuguard.com/api/model/reload \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"model_type": "all", "model_version": "3.0.0", "force": true}'

# Verify
curl https://ml.vayuguard.com/api/model/version
```

**Rollback time**: < 30 seconds (Kubernetes) / < 5 minutes (model-only)

### Database Migration Rollback

```bash
# PostgreSQL - rollback migration
cd data-pipeline
export DATABASE_URL=$POSTGRES_CONNECTION_STRING

# Run down migration
psql $DATABASE_URL -f sql/migrations/002_add_alerts.sql --rollback
# Or use dbt
dbt run --select rollback_migration_name --target production

# MongoDB - restore from backup
mongorestore --uri="$MONGODB_URI" --drop /backup/mongodb/latest/
```

**Rollback time**: 5-60 minutes (depending on data volume)

---

## Monitoring Setup

### Prometheus Configuration

**Config file**: `infrastructure/monitoring/prometheus.yml`

**Scrape targets:**

| Target | Interval | Timeout | Metrics Path |
|--------|----------|---------|-------------|
| Frontend | 30s | 10s | /api/health/metrics |
| Backend | 15s | 10s | /health/metrics |
| ML Service | 15s | 10s | /metrics |
| PostgreSQL | 30s | 10s | (postgres_exporter) |
| MongoDB | 30s | 10s | (mongodb_exporter) |
| nginx | 30s | 10s | /metrics |
| Node Exporter | 30s | 10s | /metrics |

### Grafana Dashboards

**Access**: http://grafana.vayuguard.com (admin credentials in Vault)

| Dashboard | File | Description |
|-----------|------|-------------|
| App Metrics | `infrastructure/monitoring/grafana-dashboards/app-metrics.json` | API response times, error rates, throughput |
| ML Metrics | `infrastructure/monitoring/grafana-dashboards/ml-metrics.json` | Model inference latency, prediction distribution |
| Data Pipeline | `infrastructure/monitoring/grafana-dashboards/data-pipeline.json` | Ingestion rates, quality scores, pipeline health |

### Alert Rules

**Config file**: `infrastructure/monitoring/alert-rules.yml`

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| HighErrorRate | 5xx rate > 5% for 5 min | Critical | PagerDuty |
| HighLatency | P99 > 2s for 5 min | Warning | Slack |
| PodCrashLooping | Pod restart > 3 in 10 min | Critical | PagerDuty |
| DiskUsageHigh | Node disk > 85% | Warning | Slack |
| MemoryUsageHigh | Pod memory > 90% limit | Warning | Slack |
| DatabaseConnectionPoolExhausted | Active connections > 90% pool | Critical | PagerDuty |
| MLModelDegradation | MAE increase > 20% | Warning | Slack #ml-alerts |
| CertificateExpiry | SSL cert < 14 days to expiry | Warning | Slack |

### PagerDuty Configuration

- **Service**: VayuGuard Production
- **Escalation Policy**: Primary on-call → Secondary on-call → Engineering Manager
- **Auto-resolve**: 30 minutes after alert clears
- **Notification**: Push + Phone call (Critical), Push only (Warning)

---

## Environment Configuration

### Environment Variables

See `.env.dev`, `.env.staging`, `.env.production` for complete lists.

### Secrets Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| JWT_SECRET | Vault / K8s Secret | Every 90 days |
| MONGODB_URI | Vault / K8s Secret | On compromise |
| POSTGRES_PASSWORD | Vault / RDS managed | Every 90 days |
| OPENAQ_API_KEY | Vault / K8s Secret | Annually |
| MLFLOW_S3_KEY | Vault / IAM Role | On compromise |
| SSL_CERTIFICATE | ACM / Let's Encrypt | Auto-renewal |

---

## Disaster Recovery

### Recovery Time Objectives

| Component | RTO | RPO |
|-----------|-----|-----|
| Frontend | 5 min | N/A (stateless) |
| Backend API | 10 min | N/A (stateless) |
| ML Service | 15 min | N/A (stateless) |
| MongoDB | 1 hour | 24 hours |
| PostgreSQL | 30 min | 1 hour |
| Full System | 2 hours | 24 hours |

### Backup Procedures

- **MongoDB**: Atlas automated daily snapshots (30-day retention)
- **PostgreSQL**: RDS automated backups (35-day retention) + daily pg_dump to S3
- **Manual backup script**: `infrastructure/scripts/backup-db.sh`

### Recovery Procedures

```bash
# MongoDB Recovery
# 1. From Atlas Console: Select snapshot → Restore
# 2. Or via CLI:
mongorestore --uri="$MONGODB_URI" /backup/mongodb/YYYY-MM-DD/

# PostgreSQL Recovery
# 1. From RDS Console: Restore to point-in-time
# 2. Or via pg_restore:
pg_restore --dbname="$POSTGRES_URI" --clean --if-exists /backup/postgres/YYYY-MM-DD.dump
```

---

## Security

### Network Security

- **VPC**: Private subnets for all services
- **Security Groups**: Restrictive inbound rules (only nginx accepts external traffic)
- **WAF**: AWS WAF on Application Load Balancer
- **DDoS**: AWS Shield Standard (automatic)

### Application Security

- **SSL/TLS**: Enforced on all endpoints
- **CORS**: Configured for `vayuguard.com` only
- **Rate Limiting**: nginx (100 req/min per IP, 1000 req/min per user)
- **JWT**: RS256 signed tokens, 24-hour expiry, refresh tokens (7 days)
- **Input Validation**: All API inputs validated with Joi/Zod schemas

### Compliance

- **Data Residency**: All data stored in ap-south-1 (Mumbai)
- **PII Handling**: User health data encrypted at rest (AES-256)
- **Audit Logs**: All API requests logged with user ID and timestamp

---

## Useful Commands

```bash
# Check pod status
kubectl get pods -n vayuguard-production -o wide

# View pod logs
kubectl logs -f deployment/backend -n vayuguard-production

# Execute into a pod
kubectl exec -it deployment/backend -n vayuguard-production -- /bin/sh

# Scale a service
kubectl scale deployment/backend --replicas=5 -n vayuguard-production

# Check resource usage
kubectl top pods -n vayuguard-production
kubectl top nodes

# Restart a deployment (rolling restart)
kubectl rollout restart deployment/backend -n vayuguard-production

# Check events
kubectl get events -n vayuguard-production --sort-by='.lastTimestamp'

# Port-forward for debugging
kubectl port-forward deployment/backend 5000:5000 -n vayuguard-production

# Database connections
kubectl port-forward svc/postgresql 5432:5432 -n vayuguard-production
kubectl port-forward svc/mongodb 27017:27017 -n vayuguard-production

# Helm operations
helm list -n vayuguard-production
helm history vayuguard -n vayuguard-production
helm rollback vayuguard [REVISION] -n vayuguard-production
```
