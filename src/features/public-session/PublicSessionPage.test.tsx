import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import i18n from 'i18next';
const api = vi.hoisted(() => ({ getPublicSession: vi.fn(), live: vi.fn() }));
vi.mock('./public-session-api', () => ({ getPublicSession: api.getPublicSession }));
vi.mock('./use-session-live', () => ({ useSessionLive: api.live }));
import { PublicSessionPage } from './PublicSessionPage';
const data = { session: { name: 'Friday tennis', start_time: '2026-09-25T10:00:00Z', status: 'active' }, realtime_topic: 'topic', players: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }], matches: [{ id: 'm1', number: 1, status: 'scheduled', team1_score: null, team2_score: null, participants: [{ session_player_id: 'p1', team: 1 }, { session_player_id: 'p2', team: 2 }] }], leaderboard: [] };
beforeEach(async () => { vi.resetAllMocks(); await i18n.changeLanguage('en'); api.getPublicSession.mockResolvedValue(data); api.live.mockReturnValue('live'); });
function mount() { const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={cache}><PublicSessionPage token="valid-token" /></QueryClientProvider>); return cache; }
test('anonymous view shows matches, highlights the next player, and exposes no score editing', async () => {
  mount(); await screen.findByText('Friday tennis');
  await userEvent.selectOptions(screen.getByLabelText('Highlight my matches'), 'p1');
  expect(screen.getByText('Your match is next: match 1.')).toBeTruthy();
  expect(screen.queryByRole('spinbutton')).toBeNull(); expect(screen.queryByText('Save score')).toBeNull();
});
test('a revoked token removes previously visible results after a live refresh', async () => {
  mount(); await screen.findByText('Friday tennis');
  api.getPublicSession.mockRejectedValue({ code: '42501' });
  api.live.mock.calls.at(-1)![1]();
  await screen.findByRole('alert'); expect(screen.queryByText('Friday tennis')).toBeNull();
  await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(undefined, expect.any(Function)));
});
