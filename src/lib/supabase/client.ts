import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { readSupabaseConfig } from './config';

const config = readSupabaseConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

// One shared client. Invalid configuration shows an instruction panel, not a blank page.
// Passwords are submitted directly to Supabase Auth and never stored by our code.
export const supabase = config ? createClient<Database>(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  // A timed-out write may already have committed; never retry the RPC POST implicitly.
  db: { retry: false },
  global: {
    // Give failed connections a finite timeout so the user can retry.
    fetch: (input, init) => fetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    }),
  },
}) : null;
