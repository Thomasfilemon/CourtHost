import { z } from 'zod';
import type { Database } from '../../lib/supabase/database.types';

export type Session = Database['public']['Tables']['sessions']['Row'];
export type SessionPlayer = Database['public']['Tables']['session_players']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type MatchPlayer = Database['public']['Tables']['match_players']['Row'];
export type RosterPlayer = Pick<Database['public']['Tables']['players']['Row'], 'id' | 'name' | 'default_skill_rating'>;
export type SessionDetail = { participants: SessionPlayer[]; matches: Match[]; assignments: MatchPlayer[] };
export const SESSION_PAGE_SIZE = 30;
export const sessionFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startTime: z.string().min(1).refine(value => !Number.isNaN(new Date(value).getTime())),
  durationMinutes: z.number().int().positive().max(1440),
  estimatedMatchMinutes: z.number().int().positive().max(1440),
  gameMode: z.enum(['singles', 'doubles']),
  matchmakingMode: z.enum(['random', 'skill_based']),
  playerIds: z.array(z.string().uuid()),
}).superRefine((value, ctx) => {
  if (value.playerIds.length < (value.gameMode === 'singles' ? 2 : 4)) {
    ctx.addIssue({ code: 'custom', path: ['playerIds'], message: 'playersRequired' });
  }
  if (new Set(value.playerIds).size !== value.playerIds.length) {
    ctx.addIssue({ code: 'custom', path: ['playerIds'], message: 'playersUnique' });
  }
  if (value.estimatedMatchMinutes > value.durationMinutes) {
    ctx.addIssue({ code: 'custom', path: ['estimatedMatchMinutes'], message: 'estimateTooLong' });
  }
});
export type SessionFormValues = z.infer<typeof sessionFormSchema>;
export function toCreatePayload(values: SessionFormValues) {
  return {
    name: values.name,
    start_time: new Date(values.startTime).toISOString(),
    duration_minutes: values.durationMinutes,
    estimated_match_minutes: values.estimatedMatchMinutes,
    game_mode: values.gameMode,
    matchmaking_mode: values.matchmakingMode,
    player_ids: values.playerIds,
  };
}
export function sessionErrorKey(error: unknown) {
  const data = error as { code?: string; message?: string } | null;
  if (data?.code === '42501') return 'sessions.permissionError';
  if (data?.message?.includes('Estimated duration exceeded')) return 'sessions.overtimeError';
  if (data?.message?.includes('Selected player not found or archived')) return 'sessions.playerUnavailable';
  if (data?.message?.includes('Not enough available players')) return 'sessions.notEnough';
  if (data?.message?.includes('earliest upcoming')) return 'sessions.orderError';
  if (data?.message?.includes('playing match first')) return 'sessions.playingError';
  if (data?.code === '23505') return 'sessions.duplicateError';
  return 'sessions.writeError';
}

// Both live entry and corrections use the same four-point scoring boundary.
export const liveScoreSchema = z.object({
  a: z.number().int().min(0).max(4),
  b: z.number().int().min(0).max(4),
}).refine(score => score.a + score.b <= 4);
export const finalScoreSchema = liveScoreSchema.refine(score => score.a + score.b === 4);
