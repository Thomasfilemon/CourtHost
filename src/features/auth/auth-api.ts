import { supabase } from '../../lib/supabase/client';

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Missing configuration');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  // Only sign out this browser; do not unexpectedly log out other devices.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function getHostProfile(userId: string, signal: AbortSignal) {
  if (!supabase) throw new Error('Missing configuration');
  // RLS checks the authenticated identity on the server. This UI check is not
  // the security boundary; existing RPCs also enforce host authorization.
  const { data, error } = await supabase.from('profiles')
    .select('id, full_name, role').eq('id', userId).abortSignal(signal).maybeSingle();
  if (error) throw error;
  if (!data || !['host', 'admin'].includes(data.role)) return null;
  return data;
}

export function authErrorKey(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === 'invalid_credentials') return 'auth.invalidCredentials';
  if (code === 'email_not_confirmed') return 'auth.emailNotConfirmed';
  if (code === 'over_request_rate_limit') return 'auth.rateLimited';
  return 'auth.requestFailed'; // Do not render raw server errors or credentials.
}
