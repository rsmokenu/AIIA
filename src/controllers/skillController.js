const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const AIIA_ROOT = path.resolve(process.env.AIIA_ROOT || path.join(__dirname, '../..'));
const SKILLS_DIR = path.resolve(process.env.AIIA_SKILLS_DIR || path.join(AIIA_ROOT, 'skills'));

function isSafeSkillId(skillId) {
  return typeof skillId === 'string'
    && /^[a-zA-Z0-9._-]{1,80}$/.test(skillId)
    && !skillId.includes('..');
}

function isSafeScriptName(scriptName) {
  if (typeof scriptName !== 'string' || scriptName.length === 0) return false;
  if (scriptName.includes('..') || scriptName.includes('/') || scriptName.includes('\\')) return false;
  return /\.(c?js|mjs)$/i.test(scriptName);
}

function normalizeArgs(args) {
  if (!Array.isArray(args)) return [];
  return args
    .slice(0, 20)
    .map((arg) => String(arg))
    .map((arg) => arg.slice(0, 500));
}

exports.listSkills = (req, res) => {
  try {
    const skills = fs.readdirSync(SKILLS_DIR).filter(file =>
      fs.statSync(path.join(SKILLS_DIR, file)).isDirectory()
    );
    res.json({ data: skills, count: skills.length });
  } catch (error) {
    logger.error(`Failed to list skills: ${error.message}`);
    res.status(500).json({ error: 'Could not retrieve skill registry' });
  }
};

exports.executeSkill = async (req, res) => {
  const { id } = req.params;
  const payload = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
  const { scriptName, args = [] } = payload;

  if (!isSafeSkillId(id)) {
    return res.status(400).json({ error: 'Invalid skill id format' });
  }

  if (!scriptName) return res.status(400).json({ error: 'Requires scriptName' });
  if (!isSafeScriptName(scriptName)) {
    return res.status(400).json({ error: 'Invalid scriptName. Use a local .js/.cjs/.mjs filename only.' });
  }

  const scriptPath = path.join(SKILLS_DIR, id, 'scripts', scriptName);

  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ error: `Script ${scriptName} not found in skill ${id}` });
  }

  try {
    const safeArgs = normalizeArgs(args);
    logger.info(`Executing skill ${id} script: ${scriptName} with args count: ${safeArgs.length}`);

    const output = execFileSync('node', [scriptPath, ...safeArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    res.json({ status: 'success', output });
  } catch (err) {
    logger.error(`Execution error in ${id}/${scriptName}: ${err.message}`);

    const payload = { error: 'Skill execution failed' };
    if (process.env.NODE_ENV !== 'production') {
      payload.details = err.message;
    }

    res.status(500).json(payload);
  }
};

exports.getSkillDetails = (req, res) => {
  const { id } = req.params;

  if (!isSafeSkillId(id)) {
    return res.status(400).json({ error: 'Invalid skill id format' });
  }

  const skillPath = path.join(SKILLS_DIR, id, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  try {
    const content = fs.readFileSync(skillPath, 'utf-8');
    res.json({ id, manifest: content });
  } catch (error) {
    logger.error(`Failed to read skill ${id}: ${error.message}`);
    res.status(500).json({ error: 'Error reading skill manifest' });
  }
};
