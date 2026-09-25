import { beforeEach, expect, test, vi } from 'vitest';
const fake = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../../lib/supabase/client', () => ({ supabase: fake }));
import { createSession, listSessions, runSessionAction, getSessionDetail } from './session-api';
function builder(response: object) {
  const q = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn(), abortSignal: vi.fn(), single: vi.fn() };
  for (const m of [q.select, q.eq, q.is, q.order, q.range]) m.mockReturnValue(q);
  q.abortSignal.mockResolvedValue(response); q.single.mockResolvedValue(response);
  return q;
}
beforeEach(() => { vi.clearAllMocks(); });
test('lists only owned, undeleted sessions in stable pages', async () => {
  const q = builder({ data: [], count: 31, error: null }); fake.from.mockReturnValue(q);
  const signal = new AbortController().signal;
  expect(await listSessions('host', 1, signal)).toEqual({ sessions: [], count: 31 });
  expect(fake.from).toHaveBeenCalledWith('sessions');
  expect(q.eq).toHaveBeenCalledWith('host_id', 'host');
  expect(q.is).toHaveBeenCalledWith('deleted_at', null);
  expect(q.range).toHaveBeenCalledWith(30, 59);
  expect(q.order.mock.calls).toEqual([['start_time', { ascending: false }], ['id', { ascending: true }]]);
  expect(q.abortSignal).toHaveBeenCalledWith(signal);
});
test('creates draft through host RPC with timestamp and selected player UUIDs', async () => {
  fake.rpc.mockResolvedValue({ data: { id: 'session-id', status: 'draft' }, error: null });
  const player = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await createSession({ name: '  Morning tennis  ', startTime: '2026-09-23T18:30', durationMinutes: 120,
    estimatedMatchMinutes: 20, gameMode: 'singles', matchmakingMode: 'skill_based', playerIds: [player, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] });
  expect(fake.rpc.mock.calls[0][0]).toBe('courthost_command');
  expect(fake.rpc.mock.calls[0][1]).toEqual({ p_action: 'create_session', p_data: {
    name: 'Morning tennis', start_time: new Date('2026-09-23T18:30').toISOString(),
    duration_minutes: 120, estimated_match_minutes: 20, game_mode: 'singles', matchmaking_mode: 'skill_based',
    player_ids: [player, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
  } });
  expect(fake.from).not.toHaveBeenCalled();
});
test('match actions propagate server denial and do not mutate tables directly', async () => {
  fake.rpc.mockResolvedValue({ error: { code: '42501', message: 'Host authentication required' } });
  await expect(runSessionAction('start_match', { match_id: 'm1' })).rejects.toMatchObject({ code: '42501' });
  expect(fake.rpc).toHaveBeenCalledTimes(1);
  expect(fake.from).not.toHaveBeenCalled();
});
test('session detail scopes all three reads to the selected session', async () => {
  const queries = [builder({ data: [], error: null }), builder({ data: [], error: null }), builder({ data: [], error: null })];
  fake.from.mockReturnValueOnce(queries[0]).mockReturnValueOnce(queries[1]).mockReturnValueOnce(queries[2]);
  await getSessionDetail('session-id', new AbortController().signal);
  expect(fake.from.mock.calls.map(call => call[0])).toEqual(['session_players', 'matches', 'match_players']);
  expect(queries[0].eq).toHaveBeenCalledWith('session_id', 'session-id');
  expect(queries[1].eq).toHaveBeenCalledWith('session_id', 'session-id');
  expect(queries[2].eq).toHaveBeenCalledWith('matches.session_id', 'session-id');
  expect(queries[2].select.mock.calls[0][0]).toContain('matches!inner(session_id)');
});

test.each([
  ['correct_result', { match_id: 'm1', team1_score: 2, team2_score: 2 }],
  ['withdraw_player', { session_id: 's1', session_player_id: 'p1' }],
  ['cancel_match', { match_id: 'm2' }],
] as const)('dispatches %s through the existing authorized command', async (action, data) => {
  fake.rpc.mockResolvedValue({ data: {}, error: null });
  await runSessionAction(action, data);
  expect(fake.rpc).toHaveBeenCalledWith('courthost_command', { p_action: action, p_data: data });
  expect(fake.from).not.toHaveBeenCalled();
});
