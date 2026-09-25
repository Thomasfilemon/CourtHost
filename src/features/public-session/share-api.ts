import { supabase } from '../../lib/supabase/client';
export async function getShareDetails(hostId: string, sessionId: string, signal: AbortSignal) {
  if (!supabase) throw new Error('Missing Supabase configuration');
  const { data, error } = await supabase.from('sessions').select('public_code,realtime_token,share_revoked_at,status')
    .eq('host_id', hostId).eq('id', sessionId).is('deleted_at', null).abortSignal(signal).single();
  if (error) throw error;
  return data;
}
export async function changeShare(sessionId: string, action: 'rotate_share' | 'revoke_share') {
  if (!supabase) throw new Error('Missing Supabase configuration');
  const { error } = await supabase.rpc('courthost_command', { p_action: action, p_data: { session_id: sessionId } });
  if (error) throw error;
}
