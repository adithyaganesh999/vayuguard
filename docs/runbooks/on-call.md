# VayuGuard On-Call Runbook

> Incident management guide for VayuGuard on-call engineers, including severity levels, escalation procedures, and common issue resolution.

---

## Table of Contents

1. [On-Call Expectations](#on-call-expectations)
2. [Incident Severity Levels](#incident-severity-levels)
3. [Escalation Procedures](#escalation-procedures)
4. [Common Issues & Fixes](#common-issues--fixes)
5. [Incident Response Process](#incident-response-process)
6. [Post-Incident Review](#post-incident-review)
7. [Key Contacts](#key-contacts)

---

## On-Call Expectations

### Schedule

- **Rotation**: Weekly, starting Monday 00:00 UTC
- **Primary On-Call**: 24/7 response for SEV1/SEV2
- **Secondary On-Call**: Backup for primary, handles SEV3 during business hours
- **Handoff**: Monday 09:00 IST (03:30 UTC) standup meeting

### Response Times

| Severity | Acknowledge | Mitigate | Resolve |
|----------|-------------|----------|---------|
| SEV1 (Critical) | 5 min | 30 min | 4 hours |
| SEV2 (High) | 15 min | 2 hours | 24 hours |
| SEV3 (Medium) | 1 hour | 8 hours | 72 hours |
| SEV4 (Low) | 4 hours | 24 hours | 1 week |

### On-Call Toolkit

- **PagerDuty**: https://vayuguard.pagerduty.com
- **Grafana**: http://grafana.vayuguard.com
- **K8s Dashboard**: `kubectl` CLI access
- **AWS Console**: https://console.aws.amazon.com
- **Slack Channels**: `#incidents`, `#on-call`, `#ml-alerts`
- **Runbooks**: This document + `docs/runbooks/`

---

## Incident Severity Levels

### SEV1 — Critical (Service Down)

**Definition**: Complete service outage or data loss affecting all users.

**Examples:**
- Entire application is down (5xx error rate > 50%)
- Database corruption or data loss
- Security breach (unauthorized access to user data)
- Payment/billing system failure

**Impact**: All users affected. Revenue impact. Brand damage.

**Response:**
1. Acknowledge in PagerDuty immediately
2. Join `#incidents` Slack channel
3. Create incident channel: `#inc-YYYY-MM-DD-brief-description`
4. Page secondary on-call + engineering manager
5. Begin incident bridge call
6. Update status page

---

### SEV2 — High (Major Feature Degraded)

**Definition**: Major feature unavailable or significantly degraded, but core service is operational.

**Examples:**
- AQI data not updating (stale data > 2 hours)
- Forecast service returning errors (> 10% failure rate)
- Login/authentication broken
- Alert notifications not delivering
- Map visualization broken

**Impact**: Significant subset of users affected. Core functionality impaired.

**Response:**
1. Acknowledge in PagerDuty within 15 minutes
2. Post in `#incidents` Slack channel
3. Investigate and mitigate within 2 hours
4. Notify team lead

---

### SEV3 — Medium (Minor Feature Impaired)

**Definition**: Non-critical feature not working correctly, workaround available.

**Examples:**
- Slow API response times (P99 > 3s, but < 5s)
- Occasional forecast inaccuracies
- Minor UI rendering issues
- Dashboard metrics delayed
- Single station data missing

**Impact**: Small number of users affected. Workaround exists.

**Response:**
1. Acknowledge during business hours
2. Create JIRA ticket
3. Fix within 72 hours

---

### SEV4 — Low (Cosmetic / Minor)

**Definition**: Cosmetic issue or minor bug with no functional impact.

**Examples:**
- Typo in UI text
- Chart label misalignment
- Non-critical log warnings
- Documentation errors
- Dark mode color inconsistency

**Impact**: Minimal. No user-facing impact.

**Response:**
1. Create JIRA ticket with appropriate priority
2. Fix in next sprint

---

## Escalation Procedures

### Escalation Matrix

```
Time Elapsed    SEV1                    SEV2                    SEV3
──────────────────────────────────────────────────────────────────────
0 min           Primary On-Call         Primary On-Call         —
5 min           + Secondary On-Call     —                       —
15 min          + Engineering Manager   + Secondary On-Call     Primary On-Call
30 min          + VP Engineering        + Engineering Manager   —
1 hour          + CTO                   + Team Lead             Secondary On-Call
2 hours         Executive Notification  + VP Engineering        —
4 hours         Executive Notification  Executive Notification  Engineering Manager
```

### Escalation Contacts

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| Primary On-Call | (Rotating) | PagerDuty | @oncall-primary | oncall@vayuguard.com |
| Secondary On-Call | (Rotating) | PagerDuty | @oncall-secondary | oncall-backup@vayuguard.com |
| Engineering Manager | [Name] | [Phone] | @eng-manager | eng-manager@vayuguard.com |
| VP Engineering | [Name] | [Phone] | @vp-eng | vp-eng@vayuguard.com |
| ML Team Lead | [Name] | [Phone] | @ml-lead | ml-lead@vayuguard.com |
| Data Team Lead | [Name] | [Phone] | @data-lead | data-lead@vayuguard.com |
| DevOps Lead | [Name] | [Phone] | @devops-lead | devops-lead@vayuguard.com |

---

## Common Issues & Fixes

### 1. Frontend Returns 502 Bad Gateway

**Symptoms:**
- Users see "502 Bad Gateway" or blank page
- nginx logs show upstream connection refused

**Diagnosis:**
```bash
# Check frontend pods
kubectl get pods -n vayuguard-production -l app=frontend

# Check frontend logs
kubectl logs -l app=frontend -n vayuguard-production --tail=100

# Check nginx upstream
kubectl exec -it deployment/nginx -n vayuguard-production -- nginx -T
```

**Resolution:**
```bash
# If pods are CrashLooping
kubectl describe pod <pod-name> -n vayuguard-production
kubectl logs <pod-name> -n vayuguard-production --previous

# Restart deployment
kubectl rollout restart deployment/frontend -n vayuguard-production

# If persistent, rollback
kubectl rollout undo deployment/frontend -n vayuguard-production

# Verify
curl -f https://vayuguard.com/api/health
```

---

### 2. Backend API Returning 500 Errors

**Symptoms:**
- API requests failing with 500 status
- Error logs in backend service

**Diagnosis:**
```bash
# Check backend health
curl -f http://localhost:5000/health

# Check backend logs
kubectl logs -l app=backend -n vayuguard-production --tail=200

# Check MongoDB connection
kubectl exec -it deployment/backend -n vayuguard-production -- \
  node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(e => console.error(e))"

# Check PostgreSQL connection
kubectl exec -it deployment/backend -n vayuguard-production -- \
  node -e "const {Pool} = require('pg'); new Pool({connectionString: process.env.POSTGRES_URI}).query('SELECT 1').then(r => console.log('OK')).catch(e => console.error(e))"
```

**Resolution:**
```bash
# If MongoDB connection issue
# 1. Check MongoDB Atlas status page
# 2. Verify MONGODB_URI in secrets
# 3. Restart backend
kubectl rollout restart deployment/backend -n vayuguard-production

# If OOM (out of memory)
kubectl top pods -n vayuguard-production -l app=backend
# Increase memory limit
kubectl patch deployment backend -n vayuguard-production \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"2Gi"}}}]}}}}'

# If persistent, rollback
kubectl rollout undo deployment/backend -n vayuguard-production
```

---

### 3. ML Service Not Responding

**Symptoms:**
- Forecast and health risk API calls timeout
- `/health` endpoint returns 503 or times out

**Diagnosis:**
```bash
# Check ML service health
curl -f http://localhost:8000/health

# Check ML service logs
kubectl logs -l app=ml-service -n vayuguard-production --tail=200

# Check model loading status
curl http://localhost:8000/api/model/version
```

**Resolution:**
```bash
# If model not loaded
curl -X POST http://localhost:8000/api/model/reload \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"model_type": "all"}'

# If OOM (model too large for memory)
kubectl top pods -n vayuguard-production -l app=ml-service
# Increase memory limit
kubectl patch deployment ml-service -n vayuguard-production \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"ml-service","resources":{"limits":{"memory":"8Gi"}}}]}}}}'

# If persistent, rollback
kubectl rollout undo deployment/ml-service -n vayuguard-production
```

---

### 4. Data Pipeline Not Ingesting

**Symptoms:**
- AQI data is stale (> 2 hours old)
- Grafana dashboard shows ingestion stopped

**Diagnosis:**
```bash
# Check data freshness
psql $POSTGRES_URI -c \
  "SELECT source, MAX(timestamp) as latest, NOW() - MAX(timestamp) as age FROM aqi_readings GROUP BY source;"

# Check pipeline cron job
kubectl get cronjobs -n vayuguard-production
kubectl logs -l app=data-pipeline -n vayuguard-production --tail=100

# Check external API availability
curl -f https://api.openaq.org/v2/latest?limit=1
curl -f https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current_weather=true
```

**Resolution:**
```bash
# If OpenAQ rate limited
# 1. Check API key usage
# 2. Wait for rate limit reset (1 hour)
# 3. Consider upgrading API tier

# If CPCB scraper blocked
# 1. Rotate IP address
# 2. Reduce request frequency in config
# 3. Check station_mapping.json for outdated URLs

# Manual backfill (if gap > 3 hours)
cd data-pipeline
python ingestion/orchestrator.py --backfill --hours 6
```

---

### 5. High Memory Usage on Backend

**Symptoms:**
- OOMKilled events in Kubernetes
- Slow response times
- Memory usage > 90% of limit

**Diagnosis:**
```bash
# Check memory usage
kubectl top pods -n vayuguard-production -l app=backend

# Check for memory leaks
kubectl exec -it deployment/backend -n vayuguard-production -- \
  node -e "const used = process.memoryUsage(); console.log(JSON.stringify({rss: used.rss/1024/1024+'MB', heapUsed: used.heapUsed/1024/1024+'MB', heapTotal: used.heapTotal/1024/1024+'MB'}));"

# Check connection pool status
kubectl logs -l app=backend -n vayuguard-production | rg "connection pool"
```

**Resolution:**
```bash
# Immediate: restart pod
kubectl rollout restart deployment/backend -n vayuguard-production

# Check for unclosed database connections in code
# Look for missing await, unhandled promise rejections

# Increase memory limit if legitimate growth
kubectl patch deployment backend -n vayuguard-production \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"2Gi"}}}]}}}}'
```

---

### 6. SSL Certificate Expiry

**Symptoms:**
- Browser shows "Connection Not Secure"
- Alert: CertificateExpiry in Prometheus

**Resolution:**
```bash
# Check certificate expiry
echo | openssl s_client -connect vayuguard.com:443 2>/dev/null | openssl x509 -noout -dates

# If using ACM (AWS)
aws acm list-certificates
aws acm renew-certificate --certificate-arn <arn>

# If using Let's Encrypt (cert-manager)
kubectl get certificates -n vayuguard-production
kubectl describe certificate vayuguard-tls -n vayuguard-production
# Force renewal
kubectl annotate certificate vayuguard-tls -n vayuguard-production \
  cert-manager.io/issue-temporary-certificate="true" --overwrite
```

---

## Incident Response Process

### Step-by-Step

1. **Detect**: Alert from PagerDuty, Grafana, or user report
2. **Acknowledge**: Click acknowledge in PagerDuty (starts SLA clock)
3. **Assess**: Determine severity level (SEV1-SEV4)
4. **Communicate**:
   - SEV1/SEV2: Post in `#incidents`, create incident channel
   - SEV3: Post in relevant team channel
   - SEV4: Create JIRA ticket
5. **Mitigate**: Apply fix or workaround to stop the bleeding
6. **Resolve**: Implement permanent fix
7. **Verify**: Confirm service is healthy via health endpoints and monitoring
8. **Close**: Update incident channel, close PagerDuty incident
9. **Review**: Schedule post-incident review (SEV1/SEV2 only)

### Communication Templates

**Incident Start:**
```
🚨 SEV[1/2] - [Brief Description]
Started: [Timestamp]
Impact: [What's broken, who's affected]
Current Status: Investigating
Incident Channel: #inc-YYYY-MM-DD-description
Bridge: [Zoom/Google Meet link]
```

**Incident Update:**
```
🔄 Update - [Brief Description]
Time: [Timestamp]
Status: [Investigating/Mitigating/Resolved]
Progress: [What you've tried, what you've found]
ETA: [Expected resolution time, if known]
```

**Incident Resolved:**
```
✅ Resolved - [Brief Description]
Duration: [Total incident duration]
Root Cause: [Brief description]
Resolution: [What fixed it]
Follow-up: [Action items, PIR scheduled]
```

---

## Post-Incident Review

### Required for SEV1 and SEV2 incidents

**Timeline:**
- PIR scheduled within 48 hours of incident resolution
- PIR document shared within 1 week

**Template:**
1. **Incident Summary**: One-paragraph description
2. **Timeline**: Minute-by-minute breakdown
3. **Root Cause**: Technical root cause analysis
4. **Contributing Factors**: What allowed this to happen
5. **Impact**: Duration, users affected, data impact
6. **What Went Well**: Effective response actions
7. **What Could Be Improved**: Gaps in response or system
8. **Action Items**: Concrete tasks with owners and deadlines

---

## Key Contacts

| Team | Slack Channel | On-Call | Escalation |
|------|--------------|---------|------------|
| MERN Frontend | #mern-frontend | Primary rotation | @mern-lead |
| MERN Backend | #mern-backend | Primary rotation | @mern-lead |
| AI/ML | #ml-team | @ml-oncall | @ml-lead |
| Data Pipeline | #data-pipeline | @data-oncall | @data-lead |
| DevOps/Infra | #devops | Primary rotation | @devops-lead |
| Security | #security | @security-oncall | @security-lead |

**External Vendors:**
| Vendor | Support | SLA |
|--------|---------|-----|
| MongoDB Atlas | support.mongodb.com | 1-hour P1 |
| AWS (RDS/EKS) | aws.amazon.com/support | 15-min P1 |
| Mapbox | support.mapbox.com | 24-hour P1 |
| OpenAQ | support@openaq.org | Best effort |
