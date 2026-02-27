const { randomUUID } = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const logger = require('./utils/logger');

const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
const app = express();

app.disable('x-powered-by');

function parseTrustProxy(value) {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;

  const asNumber = Number.parseInt(normalized, 10);
  if (Number.isFinite(asNumber) && asNumber >= 0) return asNumber;

  logger.warn(`Invalid AIIA_TRUST_PROXY value "${value}", defaulting to false`);
  return false;
}

app.set('trust proxy', parseTrustProxy(process.env.AIIA_TRUST_PROXY));

// Security Middleware
app.use(helmet());

const corsOrigins = (process.env.AIIA_CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors(
  corsOrigins.length
    ? {
        origin(origin, callback) {
          if (!origin || corsOrigins.includes(origin)) return callback(null, true);
          return callback(new Error('CORS origin denied'));
        },
      }
    : undefined
));

app.use(express.json({ limit: process.env.AIIA_JSON_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.AIIA_JSON_LIMIT || '1mb' }));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Logging Middleware
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) },
  skip: (req) => req.path === '/health',
}));

// Rate Limiting
function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const rateLimitWindowMs = parsePositiveInt(process.env.AIIA_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const rateLimitMax = parsePositiveInt(process.env.AIIA_RATE_LIMIT_MAX, 100);

const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests', message: 'Rate limit exceeded. Please retry later.' });
  },
});
app.use('/api/', limiter);

// Static files for Dashboard
app.use(express.static(path.join(__dirname, '../public')));

// Routes (to be implemented)
app.use('/api/v1/skills', require('./routes/skillRoutes'));
app.use('/api/v1/tools', require('./routes/toolRoutes'));
app.use('/api/v1/approvals', require('./routes/approvalRoutes'));
app.use('/api/v1/bots', require('./routes/botRoutes'));
app.use('/api/v1/system', require('./routes/systemRoutes'));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime(), version: '1.0.0' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No route for ${req.method} ${req.originalUrl}`,
  });
});

// Error Handling
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }

  if (err?.message === 'CORS origin denied') {
    return res.status(403).json({ error: 'CORS origin denied' });
  }

  const referenceId = randomUUID();
  logger.error(`[${referenceId}] ${err?.stack || err?.message || err}`);
  return res.status(500).json({ error: 'Internal Server Error', referenceId });
});

module.exports = app;
