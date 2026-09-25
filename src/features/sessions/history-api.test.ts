import { expect, test, vi } from 'vitest';
const fake = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabase/client', () => ({ supabase: fake }));
import { listHistory } from './history-api';
test('filters the full owned history before applying pagination and escapes literal wildcard characters', async () => {
  const calls: [string, unknown[]][] = [];
  const q = Object.fromEntries(['select','eq','is','in','ilike','gte','lt','order','range'].map(name => [name, (...args: unknown[]) => { calls.push([name,args]); return q; }])) as Record<string, (...args: unknown[]) => unknown>;
  q.abortSignal = vi.fn().mockResolvedValue({ data: [{ name: 'Older session' }], count: 40 }); fake.from.mockReturnValue(q);
  const result = await listHistory('host', 1, { status: 'completed', search: '50%_club', from: '2026-09-01', to: '2026-09-25' }, new AbortController().signal);
  expect(result.count).toBe(40);
  expect(calls).toContainEqual(['eq', ['host_id', 'host']]);
  expect(calls).toContainEqual(['in', ['status', ['completed']]]);
  expect(calls).toContainEqual(['ilike', ['name', '%50\\%\\_club%']]);
  expect(calls.at(-1)).toEqual(['range', [30, 59]]);
  expect(calls).toContainEqual(['lt', ['start_time', new Date('2026-09-26T00:00:00').toISOString()]]);
});
