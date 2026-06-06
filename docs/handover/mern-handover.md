# VayuGuard MERN Stack Handover Document

> Frontend setup, backend API reference, environment variables, and database setup for VayuGuard.

---

## Table of Contents

1. [Frontend Setup](#frontend-setup)
2. [Backend API Reference](#backend-api-reference)
3. [Environment Variables](#environment-variables)
4. [Database Setup](#database-setup)
5. [Authentication](#authentication)
6. [Development Workflow](#development-workflow)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Frontend Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| bun | 1.0+ | Package manager |
| Git | 2.40+ | Version control |

### Local Development

```bash
# Clone and install
cd mern-frontend
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your local values

# Start development server
bun run dev
# → http://localhost:3000

# Build for production
bun run build

# Start production server
bun run start
```

### Project Structure

```
mern-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Home/dashboard page
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles
│   │   └── api/                # Next.js API routes (proxy)
│   │       ├── auth/           # Auth endpoints
│   │       ├── aqi/            # AQI data endpoints
│   │       ├── health/         # Health risk endpoints
│   │       └── alerts/         # Alert endpoints
│   ├── components/
│   │   ├── dashboard/          # AQI dashboard components
│   │   ├── map/                # Map visualization components
│   │   ├── forecast/           # Forecast chart components
│   │   ├── alerts/             # Alert management components
│   │   ├── health/             # Health profile components
│   │   ├── auth/               # Login/signup components
│   │   ├── landing/            # Landing page sections
│   │   ├── admin/              # Admin panel components
│   │   ├── profile/            # User profile components
│   │   ├── advisory/           # Health advisory components
│   │   ├── analytics/          # Analytics view components
│   │   ├── common/             # Shared components (Toast, ErrorBoundary)
│   │   └── ui/                 # shadcn/ui base components
│   ├── context/                # React contexts
│   │   ├── AuthContext.tsx     # Authentication state
│   │   ├── AppContext.tsx      # Global app state
│   │   └── ThemeContext.jsx    # Dark/light theme
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAQIData.ts      # AQI data fetching
│   │   ├── use-mobile.ts      # Mobile detection
│   │   └── use-toast.ts       # Toast notifications
│   ├── services/               # API service layer
│   │   ├── api.js             # Base API client
│   │   ├── authService.js     # Auth API calls
│   │   ├── alertService.js    # Alert API calls
│   │   ├── forecastService.js # Forecast API calls
│   │   ├── profileService.js  # Profile API calls
│   │   └── locationService.js # Location API calls
│   ├── utils/                  # Utility functions
│   │   ├── aqiCalculator.js   # AQI computation
│   │   ├── formatters.js      # Number/date formatting
│   │   ├── colorUtils.js      # AQI color mapping
│   │   └── constants.js       # App-wide constants
│   └── lib/                    # Core libraries
│       ├── utils.ts            # shadcn utility
│       ├── db.ts               # Prisma client
│       ├── mock-data.ts        # Demo/mock data
│       └── aqi-utils.ts        # AQI helper functions
├── public/                     # Static assets
├── prisma/                     # Prisma schema (if used)
├── components.json             # shadcn/ui config
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.x | Framework |
| react | 19.x | UI library |
| typescript | 5.x | Type safety |
| tailwindcss | 4.x | Styling |
| @tanstack/react-query | 5.x | Server state management |
| zustand | 4.x | Client state management |
| recharts | 2.x | Chart library |
| mapbox-gl | 3.x | Map visualization |
| @radix-ui/* | latest | UI primitives (via shadcn) |
| next-themes | 0.x | Dark mode support |
| framer-motion | 11.x | Animations |

---

## Backend API Reference

### Base URL

- **Development**: `http://localhost:5000`
- **Staging**: `https://api-staging.vayuguard.com`
- **Production**: `https://api.vayuguard.com`

### Authentication Endpoints

#### POST `/api/auth/register`

Register a new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "user"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJSUzI1NiIs..."
  }
}
```

#### POST `/api/auth/login`

Authenticate and receive a JWT token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJSUzI1NiIs..."
  }
}
```

### AQI Endpoints

#### GET `/api/aqi/current`

Get current AQI data for a location.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lat` | number | Yes* | Latitude |
| `lng` | number | Yes* | Longitude |
| `stationId` | string | Yes* | Station ID |
| `pollutants` | boolean | No | Include pollutant breakdown (default: true) |

*One of lat/lng pair OR stationId is required.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "aqi": 142,
    "category": "Unhealthy for Sensitive Groups",
    "dominantPollutant": "pm25",
    "timestamp": "2025-01-15T10:00:00Z",
    "station": {
      "id": 42,
      "name": "ITO, Delhi",
      "code": "DL_ITO"
    },
    "pollutants": {
      "pm25": { "value": 55.2, "unit": "µg/m³", "aqi": 142 },
      "pm10": { "value": 88.4, "unit": "µg/m³", "aqi": 112 },
      "o3": { "value": 34.1, "unit": "ppb", "aqi": 45 },
      "no2": { "value": 42.8, "unit": "ppb", "aqi": 58 }
    }
  }
}
```

#### GET `/api/aqi/historical`

Get historical AQI data.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stationId` | string | Yes | Station ID |
| `startDate` | string | Yes | Start date (ISO 8601) |
| `endDate` | string | Yes | End date (ISO 8601) |
| `resolution` | string | No | `hourly`, `daily`, `weekly` (default: daily) |
| `pollutants` | boolean | No | Include pollutant data (default: true) |

#### GET `/api/aqi/forecast`

Get AQI forecast from ML service.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stationId` | string | Yes | Station ID |
| `hours` | number | No | Forecast hours (1-168, default: 48) |
| `modelType` | string | No | `lstm`, `xgboost`, `prophet`, `ensemble` (default: ensemble) |

### Alert Endpoints

#### GET `/api/alerts`

Get user's alert subscriptions.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "locationName": "Home - South Delhi",
      "thresholds": {
        "aqiLevel": "unhealthy-sensitive",
        "aqiValue": 100
      },
      "schedule": {
        "frequency": "hourly",
        "quietHours": { "start": "22:00", "end": "07:00" }
      },
      "channels": {
        "email": true,
        "push": true,
        "sms": false
      },
      "isActive": true
    }
  ]
}
```

#### POST `/api/alerts`

Create a new alert subscription.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "locationName": "Home - South Delhi",
  "location": { "coordinates": [77.209, 28.6139] },
  "thresholds": {
    "aqiLevel": "unhealthy-sensitive",
    "aqiValue": 100,
    "pollutants": ["pm25", "pm10"]
  },
  "schedule": {
    "frequency": "hourly",
    "quietHours": { "start": "22:00", "end": "07:00" },
    "days": ["mon", "tue", "wed", "thu", "fri"]
  },
  "channels": {
    "email": true,
    "push": true,
    "sms": false
  }
}
```

#### PUT `/api/alerts/:id`

Update an alert subscription.

#### DELETE `/api/alerts/:id`

Delete an alert subscription.

### Profile Endpoints

#### GET `/api/profile/health`

Get user's health profile.

**Headers:** `Authorization: Bearer <token>`

#### PUT `/api/profile/health`

Update user's health profile.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "age": 35,
  "gender": "male",
  "conditions": ["allergies"],
  "sensitivityLevel": "moderate",
  "activityLevel": "active",
  "smokingStatus": "never",
  "locationName": "Koramangala, Bangalore",
  "location": { "coordinates": [77.6224, 12.9352] }
}
```

### Health Risk Endpoint

#### GET `/api/health/risk`

Get personalized health risk assessment.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lat` | number | No | Override location latitude |
| `lng` | number | No | Override location longitude |
| `includeForecast` | boolean | No | Include 24h risk forecast (default: false) |

### Admin Endpoints

#### GET `/api/admin/users`

List all users (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

#### GET `/api/admin/system-health`

Get system health metrics (admin only).

---

## Environment Variables

### Frontend (`.env.local`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL | `http://localhost:5000` |
| `NEXT_PUBLIC_ML_URL` | Yes | ML service base URL | `http://localhost:8000` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Mapbox access token | `pk.eyJ1...` |
| `NEXT_PUBLIC_APP_NAME` | No | Application name | `VayuGuard` |
| `NEXT_PUBLIC_GA_ID` | No | Google Analytics ID | `G-XXXXXXX` |

### Backend (`.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Yes | Server port | `5000` |
| `NODE_ENV` | Yes | Environment | `development` |
| `MONGODB_URI` | Yes | MongoDB connection string | `mongodb://localhost:27017/vayuguard` |
| `JWT_SECRET` | Yes | JWT signing key | `your-256-bit-secret` |
| `JWT_EXPIRE` | No | JWT expiry duration | `24h` |
| `ML_SERVICE_URL` | Yes | ML service base URL | `http://localhost:8000` |
| `POSTGRES_URI` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/vayuguard` |
| `REDIS_URL` | No | Redis connection URL | `redis://localhost:6379` |
| `CORS_ORIGIN` | Yes | Allowed CORS origin | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit time window | `900000` (15 min) |
| `RATE_LIMIT_MAX` | No | Max requests per window | `100` |
| `LOG_LEVEL` | No | Logging level | `info` |
| `OPENAQ_API_KEY` | No | OpenAQ API key | `your-api-key` |

---

## Database Setup

### MongoDB Setup

```bash
# Install MongoDB locally (macOS)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Or use Docker
docker run -d --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=vayuguard \
  -e MONGO_INITDB_ROOT_PASSWORD=vayuguard123 \
  mongo:7

# Connection string
mongodb://vayuguard:vayuguard123@localhost:27017/vayuguard?authSource=admin
```

### PostgreSQL Setup

```bash
# Install PostgreSQL locally (macOS)
brew install postgresql@16
brew services start postgresql@16

# Or use Docker
docker run -d --name postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=vayuguard \
  -e POSTGRES_PASSWORD=vayuguard123 \
  -e POSTGRES_DB=vayuguard \
  postgres:16

# Run migrations
cd data-pipeline
psql postgresql://vayuguard:vayuguard123@localhost:5432/vayuguard \
  -f sql/migrations/001_initial.sql
psql postgresql://vayuguard:vayuguard123@localhost:5432/vayuguard \
  -f sql/migrations/002_add_alerts.sql
```

### Seed Demo Data

```bash
# Seed MongoDB with demo users and alerts
node scripts/seed-demo-data.js
```

---

## Authentication

### JWT Token Flow

1. User registers or logs in → receives access token + refresh token
2. Access token included in `Authorization: Bearer <token>` header
3. Token verified by `middleware/auth.js` on protected routes
4. Expired tokens return `401 Unauthorized`
5. Client uses refresh token to get new access token

### Token Structure

```
Header: { alg: "RS256", typ: "JWT" }
Payload: {
  sub: "507f1f77bcf86cd799439011",  // User ID
  email: "john@example.com",
  role: "user",
  iat: 1705312000,
  exp: 1705398400                   // 24 hours
}
```

### Protected Routes

All routes under `/api/alerts`, `/api/profile`, `/api/health/risk` require authentication.
Admin routes under `/api/admin/*` require `role: 'admin'`.

---

## Development Workflow

### Branch Strategy

| Branch | Purpose | Deploy Target |
|--------|---------|---------------|
| `main` | Production releases | Production |
| `develop` | Integration branch | Staging |
| `feature/*` | Feature development | — |
| `hotfix/*` | Production hotfixes | Production |

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with tests
3. Open PR against `develop` using PR template
4. CI checks must pass (lint, test, build)
5. At least one code review approval
6. Merge to `develop` → auto-deploy to staging
7. Create release PR from `develop` to `main`
8. Tag release → auto-deploy to production

### Code Style

- **ESLint**: Run `bun run lint` before committing
- **Prettier**: Auto-format on save (see `.prettierrc`)
- **TypeScript**: Strict mode enabled
- **Commit Messages**: Conventional Commits format
  - `feat: add forecast chart component`
  - `fix: resolve AQI calculation edge case`
  - `docs: update API reference`

---

## Testing

### Frontend Testing

```bash
# Run component tests
bun run test

# Run e2e tests
bun run test:e2e

# Run with coverage
bun run test:coverage
```

### Backend Testing

```bash
cd mern-backend

# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Test Structure

```
mern-backend/src/tests/
├── unit/
│   ├── auth.test.js              # Auth controller unit tests
│   ├── alertController.test.js   # Alert controller tests
│   └── mlClient.test.js         # ML service client tests
└── integration/
    ├── auth-flow.test.js         # End-to-end auth flow
    └── forecast-flow.test.js     # Forecast API integration
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Frontend build fails | Type errors | Run `bun run lint`, fix type errors |
| API 401 errors | Expired JWT | Re-login or refresh token |
| CORS errors | Wrong CORS_ORIGIN | Check backend .env CORS_ORIGIN |
| MongoDB connection refused | MongoDB not running | `brew services start mongodb-community` |
| PostgreSQL connection refused | PostgreSQL not running | `brew services start postgresql@16` |
| Map not loading | Invalid Mapbox token | Check NEXT_PUBLIC_MAPBOX_TOKEN |
| Slow API response | Missing DB indexes | Check indexes per data-schema.md |
| High memory usage | Memory leak in Next.js | Restart dev server, check for unclosed connections |
