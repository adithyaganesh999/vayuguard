# 🌬️ VayuGuard — Real-Time Air Quality Intelligence Platform

> **VayuGuard** (Sanskrit: *Vāyu* = Wind, *Guard* = Protector) is a full-stack air quality monitoring, forecasting, and health advisory platform that helps users make informed decisions about outdoor activities based on real-time and predicted air quality conditions.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Team Roles](#team-roles)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [License](#license)

---

## Project Overview

VayuGuard provides:

- **Real-time AQI Monitoring**: Live air quality data from 300+ monitoring stations across India
- **Interactive Map**: Geographic visualization with heatmap overlay showing pollution hotspots
- **ML-Powered Forecasts**: 1-hour to 7-day AQI forecasts using ensemble ML models (LSTM + XGBoost + Prophet)
- **Personalized Health Risk Assessment**: Individual risk scores based on user health profiles and current air quality
- **Smart Alerts**: Configurable threshold-based notifications via email, push, and SMS
- **Health Advisory**: Activity recommendations based on personal risk factors and AQI levels
- **Historical Trends**: Analyze air quality patterns over time with detailed charts

---

## Architecture

```
                          ┌─────────────────┐
                          │   nginx Proxy   │
                          │  (SSL, Routing)  │
                          └──┬─────┬────┬───┘
                             │     │    │
                 ┌───────────▼┐ ┌──▼────┐ ┌▼──────────┐
                 │  Frontend  │ │Backend│ │ ML Service │
                 │  (Next.js) │ │(Expr.)│ │ (FastAPI)  │
                 │  :3000     │ │ :5000 │ │  :8000     │
                 └────────────┘ └──┬────┘ └─────┬─────┘
                                   │             │
                          ┌────────▼──┐  ┌───────▼──────┐
                          │  MongoDB  │  │  Model Store  │
                          │  (Users)  │  │  (MLflow/S3)  │
                          └───────────┘  └──────────────┘
                                   │
                          ┌────────▼──┐
                          │PostgreSQL │
                          │(Analytics)│
                          └───────────┘
                                   ▲
                          ┌────────┴───┐
                          │Data Pipeline│
                          │  (Airflow)  │
                          └──┬─────┬───┘
                             │     │
                 ┌───────────▼┐ ┌──▼──────────┐
                 │  OpenAQ    │ │  Open-Meteo  │
                 │  CPCB      │ │  (Weather)   │
                 └────────────┘ └─────────────┘
```

### Services

| Service | Technology | Port | Description |
|---------|-----------|------|-------------|
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS | 3000 | User-facing web application |
| **Backend API** | Express.js + Node.js | 5000 | REST API, auth, user management |
| **ML Service** | FastAPI + Python | 8000 | AQI forecasting, health risk scoring |
| **Data Pipeline** | Python + Airflow | — | ETL pipeline for AQI/weather data |
| **MongoDB** | Atlas | 27017 | User data, profiles, alerts |
| **PostgreSQL** | RDS | 5432 | AQI readings, weather, forecasts |
| **nginx** | nginx | 80/443 | Reverse proxy, SSL, rate limiting |

---

## Team Roles

### 🤖 AI/ML Team
- **Responsibility**: ML model development, training, and deployment
- **Components**: LSTM, XGBoost, Prophet forecasting models; health risk scoring
- **Key Files**: `ml-service/`
- **Metrics**: MAE < 15, RMSE < 25, R² > 0.80 (ensemble model)
- **Handover**: [`docs/handover/ai-ml-handover.md`](docs/handover/ai-ml-handover.md)

### 📊 Data Analyst Team
- **Responsibility**: Data pipeline, quality assurance, analytics dashboards
- **Components**: Data ingestion (OpenAQ, CPCB, Open-Meteo), cleaning, transformation
- **Key Files**: `data-pipeline/`
- **Handover**: [`docs/handover/data-handover.md`](docs/handover/data-handover.md)

### 💻 MERN Stack Team
- **Responsibility**: Frontend and backend development, API design
- **Components**: Next.js frontend, Express.js backend, MongoDB schemas
- **Key Files**: `mern-frontend/`, `mern-backend/`
- **Handover**: [`docs/handover/mern-handover.md`](docs/handover/mern-handover.md)

### 🔧 DevOps Team
- **Responsibility**: Infrastructure, CI/CD, monitoring, deployments
- **Components**: Docker, Kubernetes, Terraform, Prometheus, Grafana
- **Key Files**: `infrastructure/`, `.github/`
- **Handover**: [`docs/handover/devops-handover.md`](docs/handover/devops-handover.md)

---

## Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| Next.js 16 | React framework with App Router |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Utility-first styling |
| shadcn/ui | Component library |
| Recharts | Chart library |
| Mapbox GL | Map visualization |
| Zustand | Client state management |
| TanStack Query | Server state management |
| Framer Motion | Animations |

### Backend
| Technology | Purpose |
|-----------|---------|
| Express.js | REST API framework |
| MongoDB + Mongoose | User database |
| PostgreSQL | Analytics database |
| Redis | Caching |
| JWT | Authentication |
| Joi/Zod | Input validation |

### ML Service
| Technology | Purpose |
|-----------|---------|
| FastAPI | API framework |
| PyTorch | LSTM model |
| XGBoost | Gradient boosting model |
| Prophet | Time series decomposition |
| MLflow | Model registry |
| NumPy / Pandas | Data processing |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Docker | Containerization |
| Kubernetes (EKS/GKE) | Orchestration |
| Terraform | Infrastructure as Code |
| nginx | Reverse proxy |
| Prometheus + Grafana | Monitoring |
| GitHub Actions | CI/CD |

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | `brew install node` or [nodejs.org](https://nodejs.org) |
| Python | 3.11+ | `brew install python` or [python.org](https://python.org) |
| Docker | 24+ | [docker.com](https://docker.com) |
| Docker Compose | v2+ | Included with Docker Desktop |
| Git | 2.40+ | `brew install git` |
| bun | 1.0+ | `curl -fsSL https://bun.sh/install | bash` |

### Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/vayuguard/vayuguard.git
cd vayuguard

# 2. Set up environment variables
cp .env.dev .env

# 3. Start all services
./scripts/local-dev-up.sh --build

# 4. Seed demo data
node scripts/seed-demo-data.js --clean

# 5. Access the application
# Frontend:    http://localhost:3000
# Backend API: http://localhost:5000/health
# ML Service:  http://localhost:8000/docs
# Demo Login:  admin@vayuguard.com / Admin123!
```

### Manual Setup (Without Docker)

```bash
# Start databases
docker run -d --name mongodb -p 27017:27017 mongo:7
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_USER=vayuguard \
  -e POSTGRES_PASSWORD=vayuguard123 \
  -e POSTGRES_DB=vayuguard \
  postgres:16

# Start backend
cd mern-backend
npm install
npm run dev

# Start frontend
cd mern-frontend
npm install
npm run dev

# Start ML service
cd ml-service
pip install -r requirements.txt
uvicorn inference.fastapi_app:app --host 0.0.0.0 --port 8000 --reload

# Run data pipeline migrations
cd data-pipeline
pip install -r requirements.txt
psql $POSTGRES_URI -f sql/migrations/001_initial.sql
```

### Stopping Services

```bash
# Stop all services
./scripts/local-dev-down.sh

# Stop and remove volumes (deletes database data)
./scripts/local-dev-down.sh --volumes

# Full cleanup (removes images too)
./scripts/local-dev-down.sh --clean
```

---

## API Overview

### Backend API (Express.js — Port 5000)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login and get JWT |
| GET | `/api/aqi/current` | — | Current AQI by location |
| GET | `/api/aqi/historical` | — | Historical AQI data |
| GET | `/api/aqi/forecast` | — | AQI forecast |
| GET | `/api/health/risk` | JWT | Personalized health risk |
| GET | `/api/alerts` | JWT | List alert subscriptions |
| POST | `/api/alerts` | JWT | Create alert subscription |
| PUT | `/api/alerts/:id` | JWT | Update alert subscription |
| DELETE | `/api/alerts/:id` | JWT | Delete alert subscription |
| GET | `/api/profile/health` | JWT | Get health profile |
| PUT | `/api/profile/health` | JWT | Update health profile |
| GET | `/api/admin/users` | Admin | List all users |

### ML Service API (FastAPI — Port 8000)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/forecast` | — | Generate AQI forecast |
| GET | `/api/forecast` | — | Get cached forecast |
| POST | `/api/health-risk` | — | Calculate health risk score |
| GET | `/api/model/version` | — | Current model version info |
| POST | `/api/model/reload` | Admin | Hot-reload ML model |
| GET | `/health` | — | Service health check |

**Full API spec**: [`docs/architecture/ml-api-spec.yaml`](docs/architecture/ml-api-spec.yaml)

---

## Deployment

### CI/CD Pipeline

| Workflow | Trigger | Actions |
|----------|---------|---------|
| **CI** | Pull Request | Lint, test, build all services |
| **CD Staging** | Push to `develop` | Build & deploy to staging |
| **CD Production** | Release tag (`v*`) | Build, test, approve, deploy to production |
| **Model Tests** | ML code change | Model tests, accuracy threshold check |

### Deployment Environments

| Environment | Branch | URL | Auto-Deploy |
|-------------|--------|-----|-------------|
| Staging | `develop` | staging.vayuguard.com | Yes |
| Production | `main` (tags) | vayuguard.com | Manual approval |

### Deployment Steps

```bash
# Deploy to staging (automatic on develop push)
# Or manually:
./infrastructure/scripts/deploy-staging.sh

# Deploy to production
# 1. Create release tag
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
# 2. GitHub Actions will build, test, and await approval
# 3. Approve in GitHub Actions UI
# 4. Deploy proceeds automatically

# Emergency rollback
kubectl rollout undo deployment/backend -n vayuguard-production
```

See [`docs/runbooks/rollback.md`](docs/runbooks/rollback.md) for detailed rollback procedures.

---

## Documentation

### Architecture
| Document | Description |
|----------|-------------|
| [`docs/architecture/system-architecture.png`](docs/architecture/system-architecture.png) | System architecture diagram (text) |
| [`docs/architecture/data-schema.md`](docs/architecture/data-schema.md) | MongoDB & PostgreSQL schema documentation |
| [`docs/architecture/ml-api-spec.yaml`](docs/architecture/ml-api-spec.yaml) | ML service OpenAPI 3.0 specification |

### Handover Documents
| Document | Team | Description |
|----------|------|-------------|
| [`docs/handover/ai-ml-handover.md`](docs/handover/ai-ml-handover.md) | AI/ML | Model cards, training data, metrics, API docs |
| [`docs/handover/data-handover.md`](docs/handover/data-handover.md) | Data | Pipeline overview, data sources, schedules |
| [`docs/handover/devops-handover.md`](docs/handover/devops-handover.md) | DevOps | Infrastructure, deployments, monitoring |
| [`docs/handover/mern-handover.md`](docs/handover/mern-handover.md) | MERN | Frontend setup, backend API, env vars |

### Runbooks
| Document | Description |
|----------|-------------|
| [`docs/runbooks/on-call.md`](docs/runbooks/on-call.md) | Incident severity, escalation, common fixes |
| [`docs/runbooks/rollback.md`](docs/runbooks/rollback.md) | Rollback procedures per service |
| [`docs/runbooks/data-recovery.md`](docs/runbooks/data-recovery.md) | MongoDB & PostgreSQL backup/restore |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
