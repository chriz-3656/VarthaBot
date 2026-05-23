const supabase = require('../services/supabaseClient');
const { env } = require('../config');
const EventEmitter = require('events');

class LoggerEmitter extends EventEmitter {}
const logEmitter = new LoggerEmitter();

const memoryLogs = [];
const MAX_MEMORY_LOGS = 300;
const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const LOG_LEVEL = String(env.LOG_LEVEL || 'info').toLowerCase();
const LOG_VERBOSE = String(env.LOG_VERBOSE || 'false').toLowerCase() === 'true';

// Temporary memory store for immediate dashboard access before Socket.IO integration
async function getRecentAsync(guildId = 'GLOBAL', limit = 100) {
  if (!env.SUPABASE_URL) {
    return memoryLogs.slice(0, limit);
  }

  try {
    let query = supabase
      .from('logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (guildId !== 'GLOBAL') {
      query = query.eq('guild_id', guildId);
    }
    
    const { data, error } = await query;
    if (error) return memoryLogs.slice(0, limit); // fallback

    return (data || []).map(row => ({
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      meta: row.meta
    }));
  } catch (err) {
    return memoryLogs.slice(0, limit);
  }
}

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

  // Emit to Socket.io listeners
  logEmitter.emit('log', entry);

  // Push to Supabase asynchronously without blocking
  if (env.SUPABASE_URL) {
    const guildId = meta?.guildId || 'GLOBAL';
    supabase.from('logs').insert({
      guild_id: guildId === 'GLOBAL' ? null : guildId,
      event_type: level,
      message: message,
      level: level,
      meta: meta || {},
      timestamp: entry.timestamp
    }).then(({error}) => {
      // Intentionally ignoring insert errors here to prevent infinite loop of log errors
      if (error && LOG_VERBOSE) {
        console.error('[LOGGER] DB Insert Error:', error.message);
      }
    });
  }

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
  getRecent: (limit = 100) => memoryLogs.slice(0, limit),
  getRecentAsync,
  events: logEmitter
};
