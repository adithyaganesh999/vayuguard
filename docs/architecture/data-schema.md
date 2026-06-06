# VayuGuard Data Schema Documentation

> Complete documentation of all data schemas across MongoDB and PostgreSQL databases.

---

## Table of Contents

1. [MongoDB Collections](#mongodb-collections)
   - [User](#user)
   - [HealthProfile](#healthprofile)
   - [AlertSubscription](#alertsubscription)
   - [SavedLocation](#savedlocation)
   - [Notification](#notification)
2. [PostgreSQL Tables](#postgresql-tables)
   - [stations](#stations)
   - [aqi_readings](#aqi_readings)
   - [weather_readings](#weather_readings)
   - [forecasts](#forecasts)
   - [alerts](#alerts)
3. [Index Strategy](#index-strategy)
4. [Data Retention Policy](#data-retention-policy)

---

## MongoDB Collections

### User

Stores user account information and authentication data.

```javascript
{
  _id: ObjectId,                    // Auto-generated MongoDB ID
  name: String,                     // Full name (required, 2-100 chars)
  email: {                          // Unique email (required)
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/]
  },
  password: String,                 // Bcrypt hashed password (required, min 8 chars)
  role: {                           // User role
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  avatar: String,                   // URL to avatar image (optional)
  isActive: {                       // Account active status
    type: Boolean,
    default: true
  },
  lastLogin: Date,                  // Last successful login timestamp
  preferences: {                    // User preferences
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    notificationsEnabled: { type: Boolean, default: true }
  },
  createdAt: {                      // Account creation timestamp
    type: Date,
    default: Date.now
  },
  updatedAt: {                      // Last update timestamp
    type: Date,
    default: Date.now
  }
}
```

**Indexes:**
- `email` — Unique index
- `role` — Index for admin queries
- `createdAt` — Index for analytics

---

### HealthProfile

Stores user health information for personalized risk assessment.

```javascript
{
  _id: ObjectId,                    // Auto-generated MongoDB ID
  userId: ObjectId,                 // Reference to User._id (required)
  age: Number,                      // Age in years (required, 1-120)
  gender: {                         // Gender identity
    type: String,
    enum: ['male', 'female', 'non-binary', 'prefer-not-to-say']
  },
  conditions: [String],             // Pre-existing health conditions
                                    // Values: 'asthma', 'copd', 'heart-disease',
                                    // 'diabetes', 'hypertension', 'allergies',
                                    // 'lung-cancer', 'other'
  sensitivityLevel: {               // Overall sensitivity to air pollution
    type: String,
    enum: ['low', 'moderate', 'high', 'very-high'],
    default: 'moderate'
  },
  activityLevel: {                  // Typical outdoor activity level
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'active', 'very-active'],
    default: 'moderate'
  },
  smokingStatus: {                  // Smoking status
    type: String,
    enum: ['never', 'former', 'current'],
    default: 'never'
  },
  location: {                       // Primary location
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number]           // [longitude, latitude]
  },
  locationName: String,             // Human-readable location name
  emergencyContact: {               // Emergency contact information
    name: String,
    phone: String,
    relationship: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}
```

**Indexes:**
- `userId` — Unique index (one profile per user)
- `location` — 2dsphere index for geospatial queries
- `sensitivityLevel` — Index for batch risk calculations

---

### AlertSubscription

Stores user alert configurations and thresholds.

```javascript
{
  _id: ObjectId,                    // Auto-generated MongoDB ID
  userId: ObjectId,                 // Reference to User._id (required)
  location: {                       // Monitored location
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number]           // [longitude, latitude]
  },
  locationName: String,             // Human-readable location name
  locationId: ObjectId,             // Reference to SavedLocation._id (optional)
  thresholds: {                     // AQI threshold configuration
    aqiLevel: {                     // Alert when AQI exceeds this level
      type: String,
      enum: ['good', 'moderate', 'unhealthy-sensitive', 'unhealthy', 'very-unhealthy', 'hazardous'],
      default: 'unhealthy-sensitive'
    },
    aqiValue: Number,               // Alert when AQI exceeds this numeric value (0-500)
    pollutants: [String]            // Specific pollutants to monitor
                                    // Values: 'pm25', 'pm10', 'o3', 'no2', 'so2', 'co'
  },
  schedule: {                       // Alert delivery schedule
    frequency: {                    // How often to check
      type: String,
      enum: ['realtime', 'hourly', 'daily'],
      default: 'hourly'
    },
    quietHours: {                   // Do-not-disturb period
      start: String,                // HH:mm format
      end: String                   // HH:mm format
    },
    days: [String]                  // Active days
                                    // Values: 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  },
  channels: {                       // Delivery channels
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  isActive: {                       // Subscription active status
    type: Boolean,
    default: true
  },
  lastTriggered: Date,              // Last time this alert was triggered
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}
```

**Indexes:**
- `userId` — Index for user's subscriptions
- `location` — 2dsphere index for proximity queries
- `isActive` — Index for active subscription queries
- `userId + isActive` — Compound index

---

### SavedLocation

Stores user's saved/bookmarked locations.

```javascript
{
  _id: ObjectId,                    // Auto-generated MongoDB ID
  userId: ObjectId,                 // Reference to User._id (required)
  name: String,                     // User-defined location name (required)
  location: {                       // Geographic coordinates
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number]           // [longitude, latitude]
  },
  address: {                        // Structured address
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  isPrimary: {                      // Primary location flag
    type: Boolean,
    default: false
  },
  stationId: String,                // Nearest monitoring station ID (optional)
  stationDistance: Number,           // Distance to nearest station in km
  notes: String,                    // User notes about this location
  tags: [String],                   // User-defined tags (e.g., 'home', 'office', 'school')
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}
```

**Indexes:**
- `userId` — Index for user's saved locations
- `location` — 2dsphere index for geospatial queries
- `userId + isPrimary` — Compound index for primary location lookup

---

### Notification

Stores notification history and delivery status.

```javascript
{
  _id: ObjectId,                    // Auto-generated MongoDB ID
  userId: ObjectId,                 // Reference to User._id (required)
  type: {                           // Notification type
    type: String,
    enum: ['alert', 'forecast', 'health-advisory', 'system', 'report']
  },
  priority: {                       // Notification priority
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  title: String,                    // Notification title (required)
  message: String,                  // Notification body (required)
  data: {                           // Additional structured data
    aqiValue: Number,
    locationName: String,
    pollutant: String,
    thresholdExceeded: String,
    forecastDate: Date,
    riskLevel: String,
    recommendation: String
  },
  channels: {                       // Delivery status per channel
    email: {
      sent: Boolean,
      sentAt: Date,
      error: String
    },
    push: {
      sent: Boolean,
      sentAt: Date,
      error: String
    },
    sms: {
      sent: Boolean,
      sentAt: Date,
      error: String
    }
  },
  isRead: {                         // User has read the notification
    type: Boolean,
    default: false
  },
  readAt: Date,                     // When the notification was read
  actionUrl: String,                // Deep link for notification action
  expiresAt: Date,                  // Notification expiry time
  createdAt: {
    type: Date,
    default: Date.now
  }
}
```

**Indexes:**
- `userId` — Index for user's notifications
- `userId + isRead` — Compound index for unread count
- `type + createdAt` — Compound index for filtering
- `expiresAt` — TTL index for auto-cleanup
- `priority + createdAt` — Compound index for priority sorting

---

## PostgreSQL Tables

### stations

Monitoring station metadata and location information.

```sql
CREATE TABLE stations (
    id              SERIAL PRIMARY KEY,
    station_code    VARCHAR(50) UNIQUE NOT NULL,    -- Unique station identifier from source
    name            VARCHAR(255) NOT NULL,           -- Station display name
    source          VARCHAR(50) NOT NULL,            -- Data source: 'openaq', 'cpcb'
    latitude        DECIMAL(10, 7) NOT NULL,         -- Station latitude
    longitude       DECIMAL(10, 7) NOT NULL,         -- Station longitude
    elevation       DECIMAL(8, 2),                   -- Elevation in meters
    city            VARCHAR(100),                    -- City name
    state           VARCHAR(100),                    -- State/region name
    country         VARCHAR(100) DEFAULT 'India',    -- Country name
    timezone        VARCHAR(50) DEFAULT 'Asia/Kolkata', -- Station timezone
    is_active       BOOLEAN DEFAULT true,            -- Whether station is currently reporting
    last_reading_at TIMESTAMPTZ,                     -- Timestamp of most recent reading
    pollutants_measured TEXT[],                      -- Array of measured pollutant types
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stations_source ON stations(source);
CREATE INDEX idx_stations_city ON stations(city);
CREATE INDEX idx_stations_active ON stations(is_active);
CREATE INDEX idx_stations_location ON stations USING GIST (point(longitude, latitude));
CREATE INDEX idx_stations_last_reading ON stations(last_reading_at);
```

---

### aqi_readings

Raw and aggregated air quality measurements.

```sql
CREATE TABLE aqi_readings (
    id              BIGSERIAL PRIMARY KEY,
    station_id      INTEGER NOT NULL REFERENCES stations(id),
    timestamp       TIMESTAMPTZ NOT NULL,            -- Reading timestamp (UTC)
    aqi_value       INTEGER,                         -- Calculated AQI value (0-500)
    aqi_category    VARCHAR(50),                     -- AQI category label
    pm25            DECIMAL(10, 2),                  -- PM2.5 concentration (µg/m³)
    pm10            DECIMAL(10, 2),                  -- PM10 concentration (µg/m³)
    o3              DECIMAL(10, 2),                  -- Ozone concentration (ppb)
    no2             DECIMAL(10, 2),                  -- NO2 concentration (ppb)
    so2             DECIMAL(10, 2),                  -- SO2 concentration (ppb)
    co              DECIMAL(10, 2),                  -- CO concentration (ppm)
    source          VARCHAR(50) NOT NULL,            -- Data source identifier
    is_validated    BOOLEAN DEFAULT false,           -- Whether reading passed quality checks
    quality_score   DECIMAL(3, 2),                   -- Data quality score (0.00-1.00)
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_aqi_station_timestamp UNIQUE (station_id, timestamp, source)
);

-- Indexes
CREATE INDEX idx_aqi_station_time ON aqi_readings(station_id, timestamp DESC);
CREATE INDEX idx_aqi_timestamp ON aqi_readings(timestamp DESC);
CREATE INDEX idx_aqi_aqi_value ON aqi_readings(aqi_value);
CREATE INDEX idx_aqi_category ON aqi_readings(aqi_category);
CREATE INDEX idx_aqi_validated ON aqi_readings(is_validated);
CREATE INDEX idx_aqi_pm25 ON aqi_readings(pm25) WHERE pm25 IS NOT NULL;

-- Partitioning (by month for performance)
-- CREATE TABLE aqi_readings_YYYY_MM PARTITION OF aqi_readings
--     FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01');
```

---

### weather_readings

Weather measurements correlated with AQI data.

```sql
CREATE TABLE weather_readings (
    id              BIGSERIAL PRIMARY KEY,
    station_id      INTEGER NOT NULL REFERENCES stations(id),
    timestamp       TIMESTAMPTZ NOT NULL,            -- Reading timestamp (UTC)
    temperature     DECIMAL(6, 2),                   -- Temperature (°C)
    feels_like      DECIMAL(6, 2),                   -- Feels-like temperature (°C)
    humidity        DECIMAL(5, 2),                   -- Relative humidity (%)
    pressure        DECIMAL(8, 2),                   -- Atmospheric pressure (hPa)
    wind_speed      DECIMAL(6, 2),                   -- Wind speed (km/h)
    wind_direction  DECIMAL(5, 1),                   -- Wind direction (degrees)
    wind_gust       DECIMAL(6, 2),                   -- Wind gust speed (km/h)
    precipitation   DECIMAL(8, 2),                   -- Precipitation (mm)
    cloud_cover     DECIMAL(5, 2),                   -- Cloud cover (%)
    visibility      DECIMAL(8, 2),                   -- Visibility (km)
    uv_index        DECIMAL(4, 1),                   -- UV index
    dew_point       DECIMAL(6, 2),                   -- Dew point (°C)
    source          VARCHAR(50) NOT NULL DEFAULT 'open-meteo',
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_weather_station_timestamp UNIQUE (station_id, timestamp)
);

-- Indexes
CREATE INDEX idx_weather_station_time ON weather_readings(station_id, timestamp DESC);
CREATE INDEX idx_weather_timestamp ON weather_readings(timestamp DESC);
CREATE INDEX idx_weather_temp ON weather_readings(temperature);
CREATE INDEX idx_weather_humidity ON weather_readings(humidity);
```

---

### forecasts

ML model-generated AQI forecasts.

```sql
CREATE TABLE forecasts (
    id              BIGSERIAL PRIMARY KEY,
    station_id      INTEGER NOT NULL REFERENCES stations(id),
    forecast_time   TIMESTAMPTZ NOT NULL,            -- Time being forecasted
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When forecast was generated
    model_version   VARCHAR(50) NOT NULL,            -- ML model version identifier
    model_type      VARCHAR(50) NOT NULL,            -- 'lstm', 'xgboost', 'prophet', 'ensemble'
    predicted_aqi   INTEGER NOT NULL,                -- Predicted AQI value (0-500)
    predicted_category VARCHAR(50) NOT NULL,         -- Predicted AQI category
    confidence_low  INTEGER,                         -- Lower bound of confidence interval
    confidence_high INTEGER,                         -- Upper bound of confidence interval
    confidence_score DECIMAL(3, 2),                  -- Model confidence (0.00-1.00)
    predicted_pm25  DECIMAL(10, 2),                  -- Predicted PM2.5 (µg/m³)
    predicted_pm10  DECIMAL(10, 2),                  -- Predicted PM10 (µg/m³)
    predicted_o3    DECIMAL(10, 2),                  -- Predicted O3 (ppb)
    features_used   JSONB,                           -- Feature vector snapshot
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_forecast_station_time_model UNIQUE (station_id, forecast_time, model_version)
);

-- Indexes
CREATE INDEX idx_forecast_station_time ON forecasts(station_id, forecast_time DESC);
CREATE INDEX idx_forecast_generated ON forecasts(generated_at DESC);
CREATE INDEX idx_forecast_model ON forecasts(model_type, model_version);
CREATE INDEX idx_forecast_category ON forecasts(predicted_category);
CREATE INDEX idx_forecast_confidence ON forecasts(confidence_score);
```

---

### alerts

System-generated air quality alerts.

```sql
CREATE TABLE alerts (
    id              BIGSERIAL PRIMARY KEY,
    station_id      INTEGER NOT NULL REFERENCES stations(id),
    alert_type      VARCHAR(50) NOT NULL,            -- 'aqi-threshold', 'trend-spike', 'forecast-warning'
    severity        VARCHAR(20) NOT NULL,            -- 'info', 'warning', 'danger', 'critical'
    aqi_value       INTEGER NOT NULL,                -- AQI value that triggered alert
    aqi_category    VARCHAR(50) NOT NULL,            -- Corresponding AQI category
    previous_aqi    INTEGER,                         -- Previous AQI reading for comparison
    message         TEXT NOT NULL,                   -- Alert message content
    recommendations TEXT[],                          -- Array of health recommendations
    affected_pollutants TEXT[],                      -- Pollutants causing the alert
    valid_from      TIMESTAMPTZ NOT NULL,            -- Alert start time
    valid_until     TIMESTAMPTZ,                     -- Alert end time (null = ongoing)
    is_active       BOOLEAN DEFAULT true,            -- Whether alert is currently active
    recipients_count INTEGER DEFAULT 0,              -- Number of users notified
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_alerts_station ON alerts(station_id);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_active ON alerts(is_active) WHERE is_active = true;
CREATE INDEX idx_alerts_valid_from ON alerts(valid_from DESC);
CREATE INDEX idx_alerts_station_active ON alerts(station_id, is_active) WHERE is_active = true;
```

---

## Index Strategy

### MongoDB Index Strategy

| Collection | Index | Type | Purpose |
|-----------|-------|------|---------|
| User | `email` | Unique | Login lookup |
| User | `createdAt` | Single | Analytics sorting |
| HealthProfile | `userId` | Unique | Profile lookup |
| HealthProfile | `location` | 2dsphere | Proximity queries |
| AlertSubscription | `userId + isActive` | Compound | Active subscription lookup |
| AlertSubscription | `location` | 2dsphere | Proximity alert matching |
| SavedLocation | `userId + isPrimary` | Compound | Primary location lookup |
| SavedLocation | `location` | 2dsphere | Nearby station queries |
| Notification | `userId + isRead` | Compound | Unread count |
| Notification | `expiresAt` | TTL | Auto-expire old notifications |

### PostgreSQL Index Strategy

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| stations | `station_code` | Unique | Station lookup |
| stations | `point(longitude, latitude)` | GiST | Geospatial queries |
| aqi_readings | `station_id, timestamp` | Compound | Time-series queries |
| aqi_readings | `aqi_value` | Single | Range queries |
| weather_readings | `station_id, timestamp` | Compound | Time-series queries |
| forecasts | `station_id, forecast_time` | Compound | Forecast lookup |
| forecasts | `model_type, model_version` | Compound | Model comparison |
| alerts | `station_id, is_active` | Partial | Active alerts |

---

## Data Retention Policy

| Data Type | Retention Period | Archive Policy |
|-----------|-----------------|----------------|
| Raw AQI readings | 2 years | Aggregate to hourly after 30 days |
| Hourly aggregations | 5 years | Aggregate to daily after 1 year |
| Daily aggregations | 10 years | Archive to cold storage |
| Weather readings | 2 years | Aggregate to daily after 30 days |
| Forecasts | 1 year | Delete after comparison with actuals |
| User notifications | 90 days | Delete after expiry |
| Active alerts | Until resolved | Archive after 1 year |
| Model artifacts | All versions | Keep in MLflow model registry |
