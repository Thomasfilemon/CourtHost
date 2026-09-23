import { beforeEach, expect, test, vi } from 'vitest';
const fake = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('../../lib/supabase/client', () => ({ supabase: fake }));
import { listPlayers, runPlayerCommand } from './players-api';
import { playerInputSchema } from './player-model';
beforeEach(() => { vi.resetAllMocks(); fake.rpc.mockResolvedValue({ error: null }); });
test('read query escapes wildcard search, filters archived and requests a stable page', async () => {
  const query = { select: vi.fn(), order: vi.fn(), eq: vi.fn(), ilike: vi.fn(), range: vi.fn(), abortSignal: vi.fn() };
  for (const method of [query.select, query.order, query.eq, query.ilike, query.range]) method.mockReturnValue(query);
  query.abortSignal.mockResolvedValue({ data: [], count: 30, error: null }); fake.from.mockReturnValue(query);
  const signal = new AbortController().signal;
  await listPlayers({ search: '  A%_  ', filter: 'archived', page: 1 }, signal);
  expect(query.ilike).toHaveBeenCalledWith('name', '%A\\%\\_%');
  expect(query.eq).toHaveBeenCalledWith('is_active', false);
  expect(query.order.mock.calls).toEqual([['name'], ['id']]);
  expect(query.range).toHaveBeenCalledWith(25, 49);
  expect(query.abortSignal).toHaveBeenCalledWith(signal);
});
test('create uses host-checked RPC only and propagates database rejection', async () => {
  await runPlayerCommand({ action: 'create_player', data: { name: 'Thomas', skill: 5 } });
  expect(fake.rpc).toHaveBeenCalledWith('courthost_command', { p_action: 'create_player', p_data: { name: 'Thomas', skill: 5 } });
  expect(fake.from).not.toHaveBeenCalled();
  const error = { code: '42501' }; fake.rpc.mockRejectedValueOnce(error);
  await expect(runPlayerCommand({ action: 'delete_player', data: { player_id: 'p1' } })).rejects.toBe(error);
  expect(fake.rpc).toHaveBeenCalledTimes(2);
});
test('validation rejects invalid skill and empty names before sending requests', async () => {
  for (const skill of [0, 11, 1.5, NaN]) expect(playerInputSchema.safeParse({ name: 'Player', skill }).success).toBe(false);
  await expect(runPlayerCommand({ action: 'create_player', data: { name: ' ', skill: 5 } })).rejects.toThrow();
  expect(fake.rpc).not.toHaveBeenCalled();
  expect(playerInputSchema.parse({ name: '  Player  ', skill: 10 })).toEqual({ name: 'Player', skill: 10 });
});
