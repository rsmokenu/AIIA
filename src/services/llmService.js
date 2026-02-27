const { createHash } = require('crypto');
const logger = require('../utils/logger');
const { getDB } = require('../config/database');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AIIA LLM Orchestration Service (Resilience Upgrade)
 * Features:
 * - Parallel racing + sequential fallback
 * - Model health scoring
 * - Circuit breaker cooldown for unstable models
 * - Persistent cache
 */
class LLMService {
  constructor() {
    const parsePositiveInt = (value, fallback) => {
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    this.CACHE_TTL_MS = parsePositiveInt(process.env.AIIA_CACHE_TTL_MS, 60 * 60 * 1000); // 1 hour default
    this.CACHE_CLEANUP_INTERVAL_MS = parsePositiveInt(process.env.AIIA_CACHE_CLEANUP_INTERVAL_MS, 10 * 60 * 1000);
    this.lastCacheCleanupAt = 0;
    this.isCacheCleanupRunning = false;

    this.models = [
      { id: 'gemini-2.0-flash', provider: 'google', priority: 1, weight: 1.0 },
      { id: 'gemini-1.5-flash', provider: 'google', priority: 2, weight: 0.9 },
      { id: 'gemini-1.5-pro', provider: 'google', priority: 3, weight: 0.85 },
      { id: 'gpt-4o', provider: 'openai', priority: 4, weight: 0.8 },
      { id: 'claude-3-5-sonnet', provider: 'anthropic', priority: 5, weight: 0.75 }
    ];

    this.health = new Map();
    this.FAILURE_THRESHOLD = 3;
    this.COOLDOWN_MS = 2 * 60 * 1000; // 2 min

    for (const model of this.models) {
      this.health.set(model.id, {
        failures: 0,
        successes: 0,
        lastError: null,
        cooldownUntil: 0,
        avgLatencyMs: null,
      });
    }

    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  getHealthyModels() {
    const now = Date.now();

    // Filter out models in cooldown; sort by effective score
    return this.models
      .filter((m) => {
        const h = this.health.get(m.id);
        return !h || h.cooldownUntil <= now;
      })
      .sort((a, b) => this.scoreModel(b) - this.scoreModel(a));
  }

  scoreModel(model) {
    const h = this.health.get(model.id) || {};
    const success = h.successes || 0;
    const fail = h.failures || 0;
    const total = Math.max(1, success + fail);
    const reliability = success / total;
    const latencyPenalty = h.avgLatencyMs ? Math.min(0.4, h.avgLatencyMs / 5000) : 0;
    return model.weight + reliability - latencyPenalty;
  }

  markSuccess(model, latencyMs) {
    const h = this.health.get(model.id);
    if (!h) return;

    h.successes += 1;
    h.failures = Math.max(0, h.failures - 1); // recover gradually
    h.lastError = null;
    h.cooldownUntil = 0;

    if (!h.avgLatencyMs) h.avgLatencyMs = latencyMs;
    else h.avgLatencyMs = Math.round((h.avgLatencyMs * 0.7) + (latencyMs * 0.3));
  }

  markFailure(model, error) {
    const h = this.health.get(model.id);
    if (!h) return;

    h.failures += 1;
    h.lastError = error?.message || 'unknown error';

    if (h.failures >= this.FAILURE_THRESHOLD) {
      h.cooldownUntil = Date.now() + this.COOLDOWN_MS;
      logger.warn(`Circuit breaker opened for ${model.id} (${this.COOLDOWN_MS}ms)`);
      h.failures = 0;
    }
  }

  async getCompletion(prompt, options = {}) {
    if (typeof prompt !== 'string') {
      throw new Error('Prompt must be a string');
    }

    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      throw new Error('Prompt cannot be empty');
    }

    const { useCache = true, race = true } = options;

    if (useCache) {
      const cached = await this.checkCache(normalizedPrompt);
      if (cached) {
        logger.info(`Cache hit for prompt hash: ${this.simpleHash(normalizedPrompt).slice(0, 12)}`);
        return { ...cached, cached: true };
      }
    }

    const healthy = this.getHealthyModels();
    if (!healthy.length) {
      logger.warn('All models in cooldown. Using full pool fallback.');
      return this.sequentialFallback(normalizedPrompt, options, this.models);
    }

    if (race) {
      return this.raceModels(normalizedPrompt, options, healthy);
    }

    return this.sequentialFallback(normalizedPrompt, options, healthy);
  }

  async raceModels(prompt, options, pool) {
    const racers = pool.slice(0, 2);
    logger.info(`Initiating race with: ${racers.map((m) => m.id).join(', ')}`);

    const competitorPromises = racers.map((model) =>
      this.executeModelRequest(model, prompt, options)
        .then((result) => {
          this.markSuccess(model, result.latencyMs || 0);
          return result;
        })
        .catch((err) => {
          this.markFailure(model, err);
          throw err;
        })
    );

    try {
      const winner = await Promise.any(competitorPromises);
      await this.saveToCache(prompt, winner);
      return winner;
    } catch {
      logger.warn('Race failed for top models. Falling back to sequential.');
      return this.sequentialFallback(prompt, options, pool);
    }
  }

  async sequentialFallback(prompt, options, pool = this.models) {
    for (const model of pool) {
      try {
        const result = await this.executeModelRequest(model, prompt, options);
        this.markSuccess(model, result.latencyMs || 0);
        await this.saveToCache(prompt, result);
        return result;
      } catch (err) {
        this.markFailure(model, err);
        logger.warn(`Model ${model.id} failed: ${err.message}`);
      }
    }

    // Last resort: retry once with full model list (ignores cooldown)
    if (pool !== this.models) {
      logger.warn('Healthy pool exhausted, attempting full-pool rescue pass.');
      return this.sequentialFallback(prompt, options, this.models);
    }

    throw new Error('AIIA: Global LLM Exhaustion.');
  }

  async executeModelRequest(model, prompt, options) {
    const startTime = Date.now();

    try {
      if (model.provider === 'google') {
        if (!this.genAI) throw new Error('Google Generative AI not configured (missing GEMINI_API_KEY)');
        
        const generativeModel = this.genAI.getGenerativeModel({ model: model.id });
        const result = await generativeModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const latencyMs = Date.now() - startTime;

        return {
          model: model.id,
          provider: model.provider,
          content: text,
          latency: `${latencyMs}ms`,
          latencyMs,
          orchestration: {
            mode: options.race === false ? 'sequential' : 'race+fallback',
          },
        };
      }

      // Simulated API call placeholder for other providers
      const latencyMs = Math.floor(Math.random() * 1000) + 200;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            model: model.id,
            provider: model.provider,
            content: `[Simulated ${model.id}] Response to: ${prompt}`,
            latency: `${latencyMs}ms`,
            latencyMs,
            orchestration: {
              mode: options.race === false ? 'sequential' : 'race+fallback',
            },
          });
        }, latencyMs);
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      logger.error(`Model ${model.id} error after ${latencyMs}ms: ${error.message}`);
      throw error;
    }
  }

  async checkCache(prompt) {
    try {
      const db = getDB();
      const hash = this.simpleHash(prompt);
      const row = await db.get('SELECT response, timestamp FROM prompt_cache WHERE prompt_hash = ?', [hash]);
      if (!row) return null;

      const savedAt = row.timestamp ? Date.parse(row.timestamp) : NaN;
      const isExpired = Number.isFinite(savedAt) && (Date.now() - savedAt > this.CACHE_TTL_MS);

      if (isExpired) {
        await db.run('DELETE FROM prompt_cache WHERE prompt_hash = ?', [hash]);
        return null;
      }

      return JSON.parse(row.response);
    } catch {
      return null;
    }
  }

  async maybeCleanupCache() {
    const now = Date.now();
    if (now - this.lastCacheCleanupAt < this.CACHE_CLEANUP_INTERVAL_MS) return;
    if (this.isCacheCleanupRunning) return;

    this.isCacheCleanupRunning = true;
    try {
      const db = getDB();
      const cutoffIso = new Date(now - this.CACHE_TTL_MS).toISOString();
      await db.run('DELETE FROM prompt_cache WHERE timestamp < ?', [cutoffIso]);
      this.lastCacheCleanupAt = now;
    } catch {
      logger.warn('Cache cleanup skipped');
    } finally {
      this.isCacheCleanupRunning = false;
    }
  }

  async saveToCache(prompt, response) {
    try {
      const db = getDB();
      await this.maybeCleanupCache();
      const hash = this.simpleHash(prompt);
      await db.run(
        'INSERT OR REPLACE INTO prompt_cache (prompt_hash, response, timestamp) VALUES (?, ?, ?)',
        [hash, JSON.stringify(response), new Date().toISOString()]
      );
    } catch {
      logger.error('Cache save failed');
    }
  }

  simpleHash(str) {
    return createHash('sha256').update(str, 'utf8').digest('hex');
  }
}

module.exports = new LLMService();
