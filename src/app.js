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
const { getDB } = require('./config/database');

const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
const app = express();

app.disable('x-powered-by');

// Request ID middleware for tracing/debugging
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Custom morgan token for request ID
morgan.token('req-id', (req) => req.requestId || '-');

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
app.use(helmet({ contentSecurityPolicy: false }));

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

// Logging Middleware (includes request ID for tracing)
app.use(morgan(':method :url :status :res[content-length] - :response-time ms [req-id=:req-id]', {
  stream: { write: message => logger.info(message.trim()) },
  skip: (req) => req.path === '/health',
  immediate: false,
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
app.use(express.static('C:/Users/fogen/.gemini/omnicore/public'));

// Routes (to be implemented)
app.use('/api/v1/skills', require('./routes/skillRoutes'));
app.use('/api/v1/tools', require('./routes/toolRoutes'));
app.use('/api/v1/approvals', require('./routes/approvalRoutes'));
app.use('/api/v1/bots', require('./routes/botRoutes'));
app.use('/api/v1/system', require('./routes/systemRoutes'));

// Health Check (readiness probe with DB + LLM service verification)
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    uptime: process.uptime(),
    version: '1.0.0',
    database: 'disconnected',
    llm: 'unknown',
  };

  // Check DB
  try {
    const db = getDB();
    await db.get('SELECT 1');
    health.database = 'connected';
  } catch (err) {
    logger.warn(`Health check DB failed: ${err.message}`);
    health.database = 'disconnected';
    health.status = 'DEGRADED';
  }

  // Check LLM service (non-blocking, informational)
  try {
    const llmService = require('./services/llmService');
    const healthyModels = llmService.getHealthyModels();
    health.llm = healthyModels.length > 0 ? 'ready' : 'degraded';
    health.llmHealthyModels = healthyModels.length;
    if (healthyModels.length === 0 && health.status === 'OK') {
      health.status = 'DEGRADED';
    }
  } catch (err) {
    logger.warn(`Health check LLM service failed: ${err.message}`);
    health.llm = 'error';
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No route for ${req.method} ${req.originalUrl}`,
    requestId: req.requestId,
  });
});

// Error Handling
app.use((err, req, res, next) => {
  const requestId = req.requestId || 'unknown';

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload', requestId });
  }

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large', requestId });
  }

  if (err?.message === 'CORS origin denied') {
    return res.status(403).json({ error: 'CORS origin denied', requestId });
  }

  const referenceId = randomUUID();
  logger.error(`[requestId=${requestId}] [referenceId=${referenceId}] ${err?.stack || err?.message || err}`);
  return res.status(500).json({ error: 'Internal Server Error', referenceId, requestId });
});

module.exports = app;
