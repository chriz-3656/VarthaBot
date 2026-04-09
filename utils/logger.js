const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

const LOG_FILE = path.join(DATA_DIR, 'logs.jsonl');
const memoryLogs = [];
const MAX_MEMORY_LOGS = 300;

function pushLog(level, message, meta = null) {
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

  const printable = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`;
  if (level === 'error') {
    console.error(printable);
  } else {
    console.log(printable);
  }
}

module.exports = {
  info: (message, meta) => pushLog('info', message, meta),
  warn: (message, meta) => pushLog('warn', message, meta),
  error: (message, meta) => pushLog('error', message, meta),
  getRecent: (limit = 100) => memoryLogs.slice(0, limit)
};
