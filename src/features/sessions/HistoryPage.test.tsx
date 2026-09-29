import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import i18n from 'i18next';
const api = vi.hoisted(() => ({ listHistory: vi.fn(), listSessionLeaderboard: vi.fn() }));
vi.mock('./history-api', () => ({ listHistory: api.listHistory }));
vi.mock('./session-api', () => ({ listSessionLeaderboard: api.listSessionLeaderboard }));
import { HistoryPage } from './HistoryPage';
const session = { id: 's1', name: 'Doubles night', start_time: '2026-09-23T12:00:00Z', game_mode: 'doubles', status: 'completed' };
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HistoryPage userId="host" /></QueryClientProvider>); }
beforeEach(async () => {
  vi.resetAllMocks(); await i18n.changeLanguage('en');
  api.listHistory.mockResolvedValue({ sessions: [session], count: 1 });
  api.listSessionLeaderboard.mockResolvedValue([1, 2, 3, 4].map(n => ({ session_player_id: `p${n}`, player_name: `Player ${n}`, ranking: n, matches_played: 1, points: 2 })));
});
test('one doubles match is counted once, and expanding uses the same fetched leaderboard', async () => {
  mount(); expect(await screen.findByText('1 match')).toBeTruthy();
  const toggle = screen.getByRole('button', { name: /Doubles night/ });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('table')).toBeNull();
  await userEvent.click(toggle); expect(screen.getByRole('table')).toBeTruthy();
  await userEvent.click(toggle); expect(screen.queryByRole('table')).toBeNull();
  expect(api.listSessionLeaderboard).toHaveBeenCalledTimes(1);
});
test('failed statistics never masquerade as zero matches or points', async () => {
  api.listSessionLeaderboard.mockRejectedValue(new Error('offline')); mount();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('0 matches')).toBeNull(); expect(screen.queryByText('0 player points')).toBeNull();
});
test('history has a second page and a search resets pagination', async () => {
  api.listHistory.mockResolvedValue({ sessions: [session], count: 31 }); mount();
  await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.listHistory).toHaveBeenLastCalledWith('host', 1, expect.any(Object), expect.any(AbortSignal)));
  await userEvent.type(screen.getByRole('textbox'), 'old');
  await waitFor(() => expect(api.listHistory).toHaveBeenLastCalledWith('host', 0, expect.objectContaining({ search: 'old' }), expect.any(AbortSignal)));
});

test('a filtered empty result offers a reset and returns to the unfiltered first page', async () => {
  api.listHistory.mockImplementation((_host, _page, filters) => Promise.resolve({ sessions: filters.search ? [] : [session], count: filters.search ? 0 : 1 }));
  mount(); await screen.findByText('Doubles night');
  await userEvent.type(screen.getByRole('textbox'), 'missing');
  expect(await screen.findByText('No matching sessions')).toBeTruthy();
  expect(screen.queryByText('No session history yet')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(await screen.findByText('Doubles night')).toBeTruthy();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
});
test('an inverted date range shows guidance without querying that invalid range', async () => {
  mount(); await screen.findByText('Doubles night');
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-09-25' } });
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-09-01' } });
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The end date must be on or after the start date.');
  expect(api.listHistory.mock.calls.some(call => call[2].from === '2026-09-25' && call[2].to === '2026-09-01')).toBe(false);
});
test('a failed history read can be retried in place', async () => {
  api.listHistory.mockRejectedValueOnce(new Error('offline')); mount();
  await screen.findByRole('alert'); await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Doubles night')).toBeTruthy();
});
