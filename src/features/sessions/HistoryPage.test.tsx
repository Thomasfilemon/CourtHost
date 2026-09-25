import { render, screen, waitFor } from '@testing-library/react';
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
  mount(); expect(await screen.findByText('1 matches')).toBeTruthy();
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
  expect(screen.queryByText('0 matches')).toBeNull(); expect(screen.queryByText('0 points')).toBeNull();
});
test('history has a second page and a search resets pagination', async () => {
  api.listHistory.mockResolvedValue({ sessions: [session], count: 31 }); mount();
  await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.listHistory).toHaveBeenLastCalledWith('host', 1, expect.any(Object), expect.any(AbortSignal)));
  await userEvent.type(screen.getByRole('textbox'), 'old');
  await waitFor(() => expect(api.listHistory).toHaveBeenLastCalledWith('host', 0, expect.objectContaining({ search: 'old' }), expect.any(AbortSignal)));
});
