const { createClient } = require('@supabase/supabase-js');
const { env } = require('../config');

let supabase;

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[SupabaseClient] Credentials missing in environment. Database access will fail.');
  // Initialize with dummy values so it doesn't crash on require, but will fail on query
  supabase = createClient('http://localhost', 'dummy-key');
} else {
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = supabase;
