import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

export const supabaseAdmin = config.supabase.url && config.supabase.serviceRoleKey
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
