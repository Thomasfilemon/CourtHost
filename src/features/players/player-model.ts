import { z } from 'zod';
import type { Database } from '../../lib/supabase/database.types';

export type Player = Database['public']['Tables']['players']['Row'];
export type PlayerFilter = 'all' | 'active' | 'archived';
export type PlayerListParams = { search: string; filter: PlayerFilter; page: number };
export const PAGE_SIZE = 25;
// Matches the existing database constraints. Names need not be unique.
export const playerInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  skill: z.number().int().min(1).max(10),
});
export type PlayerInput = z.infer<typeof playerInputSchema>;

export function normalizeSkillInput(value: string, emptyFallback = '') {
  if (value.trim() === '') return emptyFallback;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || !Number.isInteger(numericValue) || numericValue < 1) return '1';
  return String(Math.min(numericValue, 10));
}

export type PlayerCommand =
  | { action: 'create_player'; data: PlayerInput }
  | { action: 'update_player'; data: PlayerInput & { player_id: string } }
  | { action: 'update_player'; data: { player_id: string; is_active: true } }
  | { action: 'archive_player' | 'delete_player'; data: { player_id: string } };

export function playerErrorKey(error: unknown) {
  const detail = error as { code?: string; message?: string } | null;
  if (detail?.code === '42501') return 'players.permissionError';
  if (detail?.code === '23503' || detail?.message === 'Referenced player must be archived') return 'players.referencedError';
  if (detail?.message === 'Player not found') return 'players.notFoundError';
  if (detail?.code === '23514' || detail?.code === '22P02') return 'players.validationError';
  return 'players.saveError';
}
