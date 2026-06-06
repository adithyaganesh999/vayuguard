# VayuGuard Backend

> Express + MongoDB backend for the VayuGuard Air Quality Monitoring & Alert System.

## 🌬️ Overview

VayuGuard is an air quality monitoring platform that provides real-time AQI data, ML-powered forecasts, and personalized health alerts. This backend handles authentication, user profiles, alert subscriptions, saved locations, and acts as a proxy to the FastAPI ML service.

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **MongoDB** ≥ 6.0
- **Redis** (optional — in-memory fallback available)

### Installation

```bash
# Clone the repository
cd mern-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Docker

```bash
# Build image
docker build -f Dockerfile.mern-backend -t vayuguard-backend .

# Run container
docker run -p 5000:5000 --env-file .env vayuguard-backend
```

## 📁 Project Structure

```
mern-backend/
├── src/
│   ├── config/          # Database, JWT, Redis configuration
│   ├── controllers/     # Request handlers
│   ├── middleware/       # Auth, validation, rate limiting, error handling
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express route definitions
│   ├── services/        # Business logic & external service clients
│   ├── tests/           # Unit & integration tests
│   ├── utils/           # Logger, API response, validators
│   ├── app.js           # Express app setup
│   └── server.js        # Entry point
├── .env.example
├── Dockerfile.mern-backend
└── package.json
```

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/signup` | Register new user | ❌ |
| POST | `/api/auth/login` | Login & get tokens | ❌ |
| POST | `/api/auth/logout` | Logout & invalidate token | ✅ |
| GET | `/api/auth/me` | Get current user profile | ✅ |
| POST | `/api/auth/refresh` | Refresh access token | ❌ |

### Profile

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/profile` | Get full profile + health data | ✅ |
| PUT | `/api/profile` | Update profile & health data | ✅ |
| DELETE | `/api/profile` | Delete account & all data | ✅ |

### Forecast

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/forecast/:city` | Get AQI forecast for city | Optional |
| GET | `/api/forecast/historical/:city` | Get historical AQI data | ✅ |

### Alerts

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alerts` | Get user's alert subscriptions | ✅ |
| POST | `/api/alerts` | Create alert subscription | ✅ |
| PUT | `/api/alerts/:id` | Update alert subscription | ✅ |
| DELETE | `/api/alerts/:id` | Delete alert subscription | ✅ |
| POST | `/api/alerts/check-thresholds` | Trigger manual threshold check | ✅ Admin |

### Locations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/locations` | Get saved locations | ✅ |
| POST | `/api/locations` | Save a new location | ✅ |
| DELETE | `/api/locations/:id` | Remove saved location | ✅ |
| PUT | `/api/locations/:id/primary` | Set location as primary | ✅ |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/users` | List all users | ✅ Admin |
| GET | `/api/admin/stats` | System-wide statistics | ✅ Admin |
| GET | `/api/admin/users/:id/stats` | User-specific statistics | ✅ Admin |
| PUT | `/api/admin/users/:id/suspend` | Suspend/unsuspend user | ✅ Admin |

### System

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | ❌ |

## 🔐 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `MONGODB_URI` | `mongodb://localhost:27017/vayuguard` | MongoDB connection string |
| `REDIS_URL` | — | Redis URL (optional) |
| `JWT_SECRET` | — | JWT signing secret |
| `JWT_EXPIRY` | `7d` | Access token expiry |
| `JWT_REFRESH_SECRET` | — | Refresh token signing secret |
| `JWT_REFRESH_EXPIRY` | `30d` | Refresh token expiry |
| `ML_SERVICE_URL` | `http://localhost:8000` | FastAPI ML service URL |
| `DATA_SERVICE_URL` | `http://localhost:8001` | Data pipeline service URL |
| `SMTP_HOST` | `smtp.ethereal.email` | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `CORS_ORIGIN` | `*` | CORS allowed origin |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

## 📋 Alert Conditions

Supported threshold conditions for alert subscriptions:

| Condition | Description |
|-----------|-------------|
| `AQI>100` | Unhealthy for sensitive groups |
| `AQI>150` | Unhealthy |
| `AQI>200` | Very unhealthy |
| `AQI>300` | Hazardous |
| `PM25>35` | PM2.5 exceeds 35 µg/m³ |
| `PM25>55` | PM2.5 exceeds 55 µg/m³ |
| `PM25>150` | PM2.5 exceeds 150 µg/m³ |
| `PM10>150` | PM10 exceeds 150 µg/m³ |
| `O3>0.07` | Ozone exceeds 0.07 ppm |
| `NO2>0.05` | NO2 exceeds 0.05 ppm |
| `SO2>0.075` | SO2 exceeds 0.075 ppm |
| `CO>9` | CO exceeds 9 ppm |

## 🔄 Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| Every 15 min | Threshold Check | Checks AQI against active alert thresholds |
| Daily 3 AM | Notification Cleanup | Removes read notifications older than 30 days |

## 📜 License

MIT
