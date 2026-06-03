const { createClient } = require('@supabase/supabase-js');
const { env } = require('../config');
const ws = require('ws');

let supabase;

const supabaseOptions = {
  auth: { persistSession: false },
  realtime: {
    transport: ws
  }
};

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[SupabaseClient] Credentials missing in environment. Database access will fail.');
  // Initialize with dummy values so it doesn't crash on require, but will fail on query
  supabase = createClient('http://localhost', 'dummy-key', supabaseOptions);
} else {
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, supabaseOptions);
}

module.exports = supabase;
