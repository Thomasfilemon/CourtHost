import { z } from 'zod';
import { supabase } from '../../lib/supabase/client';
const score = z.number().nullable();
export const publicSessionSchema = z.object({
  session: z.object({ name: z.string(), start_time: z.string(), duration_minutes: z.number(), game_mode: z.enum(['singles', 'doubles']), status: z.string() }),
  realtime_topic: z.string().regex(/^courthost:[a-f0-9]{64}$/),
  players: z.array(z.object({ id: z.string(), name: z.string(), is_retired: z.boolean() })),
  matches: z.array(z.object({ id: z.string(), number: z.number(), status: z.string(), team1_score: score, team2_score: score,
    participants: z.array(z.object({ session_player_id: z.string(), team: z.number() })).nullable().transform(value => value ?? []) })),
  leaderboard: z.array(z.object({ session_player_id: z.string(), player_name: z.string(), ranking: z.number(), matches_played: z.number(), wins: z.number(), draws: z.number(), losses: z.number(), points: z.number(), game_difference: z.number() })),
});
export type PublicSession = z.infer<typeof publicSessionSchema>;
export async function getPublicSession(token: string, signal: AbortSignal) {
  if (!supabase) throw new Error('Missing Supabase configuration');
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Session unavailable');
  // Always authorize through the token RPC. Broadcast payloads never contain trusted data.
  const { data, error } = await supabase.rpc('get_public_session', { p_token: token }).abortSignal(signal);
  if (error) throw error;
  return publicSessionSchema.parse(data);
}
