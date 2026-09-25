import { expect, test, vi } from 'vitest';
const fake = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase/client', () => ({ supabase: fake }));
import { getPublicSession } from './public-session-api';
test('rejects malformed tokens locally and propagates token authorization failures', async () => {
  const signal = new AbortController().signal;
  await expect(getPublicSession('session-id', signal)).rejects.toThrow('Session unavailable');
  expect(fake.rpc).not.toHaveBeenCalled();
  fake.rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) });
  await expect(getPublicSession('a'.repeat(64), signal)).rejects.toMatchObject({ code: '42501' });
  expect(fake.rpc).toHaveBeenCalledWith('get_public_session', { p_token: 'a'.repeat(64) });
});
