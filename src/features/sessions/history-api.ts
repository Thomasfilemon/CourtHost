import { supabase } from '../../lib/supabase/client';
import { SESSION_PAGE_SIZE } from './session-model';
export type HistoryFilters = { status: 'all' | 'completed' | 'cancelled'; search: string; from: string; to: string };
export async function listHistory(hostId: string, page: number, filters: HistoryFilters, signal: AbortSignal) {
  if (!supabase) throw new Error('Missing Supabase configuration');
  let query = supabase.from('sessions').select('id,name,start_time,game_mode,status,duration_minutes', { count: 'exact' })
    .eq('host_id', hostId).is('deleted_at', null).in('status', filters.status === 'all' ? ['completed', 'cancelled'] : [filters.status]);
  // Escape LIKE metacharacters: searching a name must not turn into a wildcard query.
  if (filters.search.trim()) query = query.ilike('name', `%${filters.search.trim().replace(/[\\%_]/g, '\\$&')}%`);
  if (filters.from) query = query.gte('start_time', new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00`); end.setDate(end.getDate() + 1);
    query = query.lt('start_time', end.toISOString());
  }
  const { data, count, error } = await query.order('start_time', { ascending: false }).order('id')
    .range(page * SESSION_PAGE_SIZE, (page + 1) * SESSION_PAGE_SIZE - 1).abortSignal(signal);
  if (error) throw error;
  return { sessions: data ?? [], count: count ?? 0 };
}
