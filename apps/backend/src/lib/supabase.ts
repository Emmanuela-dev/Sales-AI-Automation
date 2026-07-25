import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Admin client — for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Anon client — for user-scoped operations (respects RLS)
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
