/**
 * M-Pesa Payment Backend for Shopify
 * Express.js server handling Daraja API integration
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const mpesaRoutes = require('./routes/mpesa');

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// MIDDLEWARE
// ===========================================

// Security headers
app.use(helmet());

// Request logging
app.use(morgan('combined'));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ===========================================
// ROUTES
// ===========================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.DARAJA_ENV || 'sandbox',
  });
});

// M-Pesa API routes
app.use('/api/mpesa', mpesaRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(err.status || 500).json({
    error: message,
  });
});

// ===========================================
// SERVER STARTUP
// ===========================================

// Validate required environment variables
const requiredEnvVars = [
  'DARAJA_CONSUMER_KEY',
  'DARAJA_CONSUMER_SECRET',
  'DARAJA_SHORTCODE',
  'DARAJA_PASSKEY',
  'DARAJA_CALLBACK_URL',
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  console.error('Please check your .env file');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         M-PESA PAYMENT SERVER STARTED                     ║
╠═══════════════════════════════════════════════════════════╣
║  Port:        ${PORT}                                          ║
║  Environment: ${(process.env.DARAJA_ENV || 'sandbox').padEnd(41)}║
║  Shortcode:   ${(process.env.DARAJA_SHORTCODE || 'NOT SET').padEnd(41)}║
║  Callback:    ${(process.env.DARAJA_CALLBACK_URL || 'NOT SET').substring(0, 41).padEnd(41)}║
╚═══════════════════════════════════════════════════════════╝

Endpoints:
  POST /api/mpesa/stkpush     - Initiate payment
  POST /api/mpesa/callback    - Safaricom callback
  GET  /api/mpesa/status/:id  - Check payment status
  GET  /health                - Health check
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
