# VayuGuard Frontend

Real-time air quality monitoring and health advisory web application built with Next.js 16, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 with shadcn/ui components
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Database**: Prisma ORM with SQLite
- **State Management**: React Context + Zustand
- **API**: Next.js API Routes (App Router)

## Project Structure

```
mern-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API route handlers
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/
│   │   ├── admin/              # Admin panel components
│   │   │   ├── AdminPanel.jsx
│   │   │   ├── AlertConfig.jsx
│   │   │   ├── SystemHealth.jsx
│   │   │   └── UserManagement.jsx
│   │   ├── alerts/             # Alert components
│   │   │   ├── AlertForm.jsx
│   │   │   ├── AlertList.jsx
│   │   │   ├── AlertsView.tsx
│   │   │   └── ThresholdSlider.jsx
│   │   ├── advisory/           # Health advisory components
│   │   │   └── AdvisoryView.tsx
│   │   ├── analytics/          # Analytics components
│   │   │   └── AnalyticsView.tsx
│   │   ├── auth/               # Authentication components
│   │   │   ├── LoginView.tsx
│   │   │   └── SignupView.tsx
│   │   ├── common/             # Shared components
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   └── ToastNotifications.jsx
│   │   ├── dashboard/          # Dashboard components
│   │   │   ├── AQIGauge.tsx
│   │   │   ├── DashboardView.tsx
│   │   │   ├── LocationSelector.tsx
│   │   │   ├── PollutantCard.tsx
│   │   │   └── TrendChart.tsx
│   │   ├── forecast/           # Forecast components
│   │   │   ├── ConfidenceInterval.jsx
│   │   │   ├── DailyForecast.jsx
│   │   │   ├── ForecastChart.jsx
│   │   │   ├── ForecastView.tsx
│   │   │   └── HourlyForecast.jsx
│   │   ├── health/             # Health components
│   │   │   ├── HealthProfile.jsx
│   │   │   ├── PersonalAdvisory.jsx
│   │   │   └── RiskLevelIndicator.jsx
│   │   ├── history/            # Historical data components
│   │   │   ├── DateRangePicker.jsx
│   │   │   └── HistoricalTrends.jsx
│   │   ├── landing/            # Landing page sections
│   │   │   ├── CitiesSection.tsx
│   │   │   ├── ContactSection.tsx
│   │   │   ├── HeroSection.tsx
│   │   │   ├── ServicesSection.tsx
│   │   │   └── StatsSection.tsx
│   │   ├── map/                # Map components
│   │   │   ├── HeatmapLayer.jsx
│   │   │   ├── LocationSearch.jsx
│   │   │   ├── MapMarker.jsx
│   │   │   └── MapView.tsx
│   │   ├── profile/            # Profile components
│   │   │   ├── NotificationSettings.jsx
│   │   │   ├── ProfileView.tsx
│   │   │   └── SavedLocations.jsx
│   │   ├── providers/          # Context providers
│   │   │   └── QueryProvider.tsx
│   │   └── ui/                 # shadcn/ui components
│   ├── context/                # React contexts
│   │   ├── AlertContext.jsx
│   │   ├── AppContext.tsx
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.jsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAlerts.js
│   │   ├── useAuth.js
│   │   ├── useForecast.js
│   │   ├── useGeolocation.js
│   │   ├── useAQIData.ts
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   ├── lib/                    # Utilities
│   │   ├── aqi-utils.ts
│   │   ├── db.ts
│   │   ├── mock-data.ts
│   │   └── utils.ts
│   ├── pages/                  # Page components
│   │   ├── AdminPage.jsx
│   │   ├── AlertsPage.jsx
│   │   ├── ForecastPage.jsx
│   │   ├── HealthPage.jsx
│   │   ├── HistoryPage.jsx
│   │   ├── HomePage.jsx
│   │   ├── MapPage.jsx
│   │   └── ProfilePage.jsx
│   ├── services/               # API service layer
│   │   ├── alertService.js
│   │   ├── api.js
│   │   ├── authService.js
│   │   ├── forecastService.js
│   │   ├── locationService.js
│   │   └── profileService.js
│   ├── styles/                 # CSS styles
│   │   ├── global.css
│   │   ├── tailwind.css
│   │   └── variables.css
│   ├── tests/                  # Test files
│   │   ├── components/
│   │   │   ├── ForecastChart.test.jsx
│   │   │   └── Login.test.jsx
│   │   └── e2e/
│   │       ├── auth.spec.js
│   │       └── forecast.spec.js
│   └── utils/                  # Utility modules
│       ├── aqiCalculator.js
│       ├── colorUtils.js
│       ├── constants.js
│       └── formatters.js
├── prisma/                     # Database schema
│   └── schema.prisma
├── db/                         # SQLite database
├── public/                     # Static assets
├── .env.example
├── Dockerfile.mern-frontend
├── nginx.conf
├── components.json
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm or bun package manager

### Installation

```bash
cd mern-frontend
npm install
```

### Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Database

```bash
npm run db:push     # Push schema changes
npm run db:generate # Generate Prisma client
```

## Features

- **Real-time AQI Monitoring**: Live air quality data from 500+ stations
- **Interactive Map**: SVG-based AQI map with heatmap layers
- **72-Hour Forecast**: AI-powered predictions with confidence intervals
- **Health Advisory**: Personalized recommendations based on health profile
- **Smart Alerts**: Customizable AQI threshold notifications
- **Historical Analytics**: Trend analysis with date range selection
- **Dark Theme**: Glass morphism design with emerald accent colors
- **Responsive**: Mobile-first design with touch-friendly interactions

## API Integration

The frontend connects to the VayuGuard backend through:

- **REST API**: `/api/*` endpoints for data fetching
- **WebSocket**: Real-time AQI updates
- **API Service Layer**: Organized service modules in `src/services/`

## Design System

- **Colors**: Emerald (#10b981) primary, dark background (#0a0a0a)
- **Typography**: Geist Sans font family
- **Components**: shadcn/ui New York style
- **Effects**: Glass morphism, noise overlay, aurora glow
- **Animations**: Framer Motion spring transitions

## Docker Deployment

```bash
docker build -f Dockerfile.mern-frontend -t vayuguard-frontend .
docker run -p 80:80 vayuguard-frontend
```

## License

Proprietary - VayuGuard Project
