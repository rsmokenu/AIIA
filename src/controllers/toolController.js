const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const llmService = require('../services/llmService');

const AIIA_ROOT = path.resolve(process.env.AIIA_ROOT || path.join(__dirname, '../..'));
const SKILLS_DIR = path.resolve(process.env.AIIA_SKILLS_DIR || path.join(AIIA_ROOT, '..', 'skills'));
const AUDIT_SCRIPT_PATH = path.join(SKILLS_DIR, 'gemini-ascension', 'scripts', 'verify_tools.cjs');

exports.completions = async (req, res) => {
  const payload = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
  const { prompt, options } = payload;

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Payload must include a non-empty string "prompt"' });
  }

  if (prompt.length > 20_000) {
    return res.status(400).json({ error: 'Prompt exceeds maximum length (20,000 chars)' });
  }

  if (options !== undefined && (typeof options !== 'object' || Array.isArray(options) || options === null)) {
    return res.status(400).json({ error: '"options" must be an object when provided' });
  }

  const normalizedOptions = {};
  if (options && Object.prototype.hasOwnProperty.call(options, 'useCache')) {
    if (typeof options.useCache !== 'boolean') {
      return res.status(400).json({ error: '"options.useCache" must be boolean when provided' });
    }
    normalizedOptions.useCache = options.useCache;
  }

  if (options && Object.prototype.hasOwnProperty.call(options, 'race')) {
    if (typeof options.race !== 'boolean') {
      return res.status(400).json({ error: '"options.race" must be boolean when provided' });
    }
    normalizedOptions.race = options.race;
  }

  try {
    const response = await llmService.getCompletion(prompt, normalizedOptions);
    res.json(response);
  } catch (error) {
    logger.error(`LLM Orchestration error: ${error.message}`);

    const payload = { error: 'LLM service unavailable' };
    if (process.env.NODE_ENV !== 'production') {
      payload.details = error.message;
    }

    res.status(503).json(payload);
  }
};

exports.summarize = async (req, res) => {
  const payload = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
  const { text, ratio = 0.3 } = payload;

  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Payload must include string "text"' });
  }

  if (!text.trim()) {
    return res.status(400).json({ error: '"text" cannot be empty' });
  }

  if (text.length > 200_000) {
    return res.status(400).json({ error: '"text" exceeds maximum length (200,000 chars)' });
  }

  try {
    const safeRatio = Number.isFinite(Number(ratio))
      ? Math.min(1, Math.max(0.05, Number(ratio)))
      : 0.3;

    const prompt = `Please summarize the following text to approximately ${Math.round(safeRatio * 100)}% of its original length. Focus on key information and maintain a professional tone:\n\n${text}`;
    
    const result = await llmService.getCompletion(prompt, { useCache: true, race: true });
    
    res.json({ 
      summary: result.content, 
      meta: { 
        originalLength: text.length, 
        ratio: safeRatio,
        model: result.model,
        provider: result.provider
      } 
    });
  } catch (error) {
    logger.error(`Summarization error: ${error.message}`);
    res.status(500).json({ error: 'Summarization failed' });
  }
};

exports.auditEnvironment = (req, res) => {
  try {
    if (!fs.existsSync(AUDIT_SCRIPT_PATH)) {
      return res.status(404).json({ error: 'Audit script not found' });
    }

    const report = execFileSync('node', [AUDIT_SCRIPT_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    res.json({ report });
  } catch (error) {
    logger.error(`Environment audit failed: ${error.message}`);
    res.status(500).json({ error: 'Internal audit failed' });
  }
};
