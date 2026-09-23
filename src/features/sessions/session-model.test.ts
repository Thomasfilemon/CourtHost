import { expect, test } from 'vitest';
import { sessionFormSchema, toCreatePayload } from './session-model';
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const c = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const d = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const base = { name: '  Club Night  ', startTime: '2026-09-23T19:00', durationMinutes: 120,
  estimatedMatchMinutes: 20, gameMode: 'singles' as const, matchmakingMode: 'skill_based' as const, playerIds: [a, b] };
test('session validation enforces singles/doubles minimums and no duplicate players', () => {
  expect(sessionFormSchema.safeParse(base).success).toBe(true);
  expect(sessionFormSchema.safeParse({ ...base, playerIds: [a] }).success).toBe(false);
  expect(sessionFormSchema.safeParse({ ...base, playerIds: [a, a] }).success).toBe(false);
  expect(sessionFormSchema.safeParse({ ...base, gameMode: 'doubles', playerIds: [a, b, c] }).success).toBe(false);
  expect(sessionFormSchema.safeParse({ ...base, gameMode: 'doubles', playerIds: [a, b, c, d] }).success).toBe(true);
  expect(sessionFormSchema.safeParse({ ...base, estimatedMatchMinutes: 121 }).success).toBe(false);
});
test('create payload follows implemented backend names and preserves local chosen instant', () => {
  const parsed = sessionFormSchema.parse(base);
  expect(toCreatePayload(parsed)).toEqual({ name: 'Club Night', start_time: new Date(base.startTime).toISOString(),
    duration_minutes: 120, estimated_match_minutes: 20, game_mode: 'singles', matchmaking_mode: 'skill_based', player_ids: [a, b] });
});
