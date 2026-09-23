import { supabase } from '../../lib/supabase/client';
import { PAGE_SIZE, playerInputSchema } from './player-model';
import type { PlayerCommand, PlayerListParams } from './player-model';

export async function listPlayers(params: PlayerListParams, signal: AbortSignal) {
  if (!supabase) throw new Error('Missing configuration');
  let query = supabase.from('players')
    .select('id,name,default_skill_rating,is_active,created_at', { count: 'exact' })
    .order('name').order('id'); // Stable order, including duplicate player names.
  if (params.filter !== 'all') query = query.eq('is_active', params.filter === 'active');
  if (params.search.trim()) {
    // Treat % and _ as literal search characters, not SQL wildcards.
    const literal = params.search.trim().replace(/[\\%_]/g, '\\$&');
    query = query.ilike('name', `%${literal}%`);
  }
  const start = params.page * PAGE_SIZE;
  const { data, count, error } = await query.range(start, start + PAGE_SIZE - 1).abortSignal(signal);
  if (error) throw error;
  return { players: data ?? [], count: count ?? 0 };
}

export async function runPlayerCommand(command: PlayerCommand) {
  if (!supabase) throw new Error('Missing configuration');
  if ('name' in command.data) playerInputSchema.parse(command.data);
  // All writes go through the existing host-checked RPC. Never write tables directly.
  // Do not automatically retry a write: a timed-out response may already have committed.
  const { error } = await supabase.rpc('courthost_command', {
    p_action: command.action, p_data: command.data,
  });
  if (error) throw error;
}
