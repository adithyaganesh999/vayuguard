const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { generalLimiter } = require('./middleware/rateLimit');
const loggingMiddleware = require('./middleware/logging');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const forecastRoutes = require('./routes/forecast');
const alertRoutes = require('./routes/alerts');
const locationRoutes = require('./routes/locations');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');

const app = express();

// ─── Security & Parsing Middleware ─────────────────────────────────────────

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Logging & Rate Limiting ──────────────────────────────────────────────

app.use(loggingMiddleware);
app.use('/api/', generalLimiter);

// ─── API Routes ───────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/health', healthRoutes);

// ─── Root endpoint ────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    name: 'VayuGuard API',
    version: '1.0.0',
    description: 'Air Quality Monitoring & Alert System Backend',
    documentation: '/api/docs',
    health: '/api/health',
  });
});

// ─── Error Handling ───────────────────────────────────────────────────────

// 404 handler for unmatched routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
