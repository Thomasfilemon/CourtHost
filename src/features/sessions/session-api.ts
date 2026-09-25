import { supabase } from '../../lib/supabase/client';
import type { Json } from '../../lib/supabase/database.types';
import { SESSION_PAGE_SIZE, sessionFormSchema, toCreatePayload } from './session-model';
import type { Session, SessionFormValues } from './session-model';
import type { Tables } from '../../lib/supabase/database.types';

export type SessionLeaderboardRow = Tables<'session_leaderboards'>;

function client() {
  if (!supabase) throw new Error('Missing Supabase configuration');
  return supabase;
}
export async function listSessions(hostId: string, page: number, signal: AbortSignal) {
  const from = page * SESSION_PAGE_SIZE;
  const { data, count, error } = await client().from('sessions')
    .select('id,host_id,name,start_time,duration_minutes,estimated_match_minutes,game_mode,matchmaking_mode,status,created_at,deleted_at', { count: 'exact' })
    .eq('host_id', hostId).is('deleted_at', null)
    .order('start_time', { ascending: false }).order('id', { ascending: true })
    .range(from, from + SESSION_PAGE_SIZE - 1).abortSignal(signal);
  if (error) throw error;
  return { sessions: data ?? [], count: count ?? 0 };
}
export async function getHostSession(hostId: string, sessionId: string) {
  const { data, error } = await client().from('sessions').select('*')
    .eq('host_id', hostId).eq('id', sessionId).is('deleted_at', null).single();
  if (error) throw error;
  return data;
}
export async function listSessionLeaderboard(sessionId: string, signal: AbortSignal) {
  const { data, error } = await client().from('session_leaderboards').select('*')
    .eq('session_id', sessionId).order('ranking').order('player_name').abortSignal(signal);
  if (error) throw error;
  return data ?? [];
}
export async function listActiveRoster(signal: AbortSignal) {
  const roster: { id: string; name: string; default_skill_rating: number }[] = [];
  // Supabase API defaults to a 1000-row limit. Page so a larger venue can select everyone.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client().from('players')
      .select('id,name,default_skill_rating').eq('is_active', true)
      .order('name').order('id').range(offset, offset + 499).abortSignal(signal);
    if (error) throw error;
    roster.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return roster;
}
export async function getSessionDetail(sessionId: string, signal: AbortSignal) {
  const db = client();
  const [members, matches, assignments] = await Promise.all([
    db.from('session_players').select('id,session_id,player_id,name_snapshot,skill_rating,is_retired,created_at').eq('session_id', sessionId).order('created_at').abortSignal(signal),
    db.from('matches').select('id,session_id,match_number,round_number,status,team1_score,team2_score,started_at,finished_at,court_number,cancellation_reason,created_at').eq('session_id', sessionId).order('match_number').abortSignal(signal),
    db.from('match_players').select('id,match_id,session_player_id,team,created_at,matches!inner(session_id)').eq('matches.session_id', sessionId).abortSignal(signal),
  ]);
  if (members.error) throw members.error;
  if (matches.error) throw matches.error;
  if (assignments.error) throw assignments.error;
  return { participants: members.data ?? [], matches: matches.data ?? [], assignments: assignments.data ?? [] };
}
async function command(action: string, data: Record<string, Json | undefined>) {
  // No client table writes; the existing host-checked database function owns state transitions.
  const result = await client().rpc('courthost_command', { p_action: action, p_data: data });
  if (result.error) throw result.error;
  return result.data;
}
export async function createSession(values: SessionFormValues) {
  const payload = toCreatePayload(sessionFormSchema.parse(values));
  const data = await command('create_session', payload);
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.id !== 'string') throw new Error('Missing session ID');
  return data as unknown as Session;
}
export async function runSessionAction(action: 'generate_batch' | 'start_match' | 'save_score' | 'finish_match' | 'end_session' | 'cancel_session' | 'delete_session' | 'correct_result' | 'withdraw_player' | 'cancel_match', data: Record<string, Json | undefined>) {
  return command(action, data);
}
