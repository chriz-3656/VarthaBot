const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

const LOG_FILE = path.join(DATA_DIR, 'logs.jsonl');
const memoryLogs = [];
const MAX_MEMORY_LOGS = 300;
const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const LOG_LEVEL = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const LOG_VERBOSE = String(process.env.LOG_VERBOSE || 'false').toLowerCase() === 'true';

function shouldLog(level) {
  const current = LEVELS[LOG_LEVEL] || LEVELS.info;
  const incoming = LEVELS[level] || LEVELS.info;
  return incoming >= current;
}

function pushLog(level, message, meta = null) {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta
  };

  memoryLogs.unshift(entry);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.pop();
  }

  const serialized = `${JSON.stringify(entry)}\n`;
  fs.appendFile(LOG_FILE, serialized, () => {});

  const metaText = meta && LOG_VERBOSE ? ` ${JSON.stringify(meta)}` : '';
  const printable = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}${metaText}`;
  if (level === 'error') {
    console.error(printable);
  } else {
    console.log(printable);
  }
}

module.exports = {
  debug: (message, meta) => pushLog('debug', message, meta),
  info: (message, meta) => pushLog('info', message, meta),
  warn: (message, meta) => pushLog('warn', message, meta),
  error: (message, meta) => pushLog('error', message, meta),
  getRecent: (limit = 100) => memoryLogs.slice(0, limit)
};
