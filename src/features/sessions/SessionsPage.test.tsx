import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import i18n from 'i18next';
const api = vi.hoisted(() => ({ listSessions: vi.fn(), listActiveRoster: vi.fn(), createSession: vi.fn(), getSessionDetail: vi.fn(), runSessionAction: vi.fn(), getHostSession: vi.fn() }));
vi.mock('./session-api', () => api);
import { SessionsPage } from './SessionsPage';
const roster = [1, 2, 3, 4].map(n => ({ id: `${n}`.repeat(8) + '-aaaa-4aaa-8aaa-' + `${n}`.repeat(12), name: `Player ${n}`, default_skill_rating: n + 3 }));
const session = { id: 'session-id', host_id: 'host', name: 'Club Night', start_time: '2026-09-23T19:00:00Z', duration_minutes: 120,
  estimated_match_minutes: 20, game_mode: 'singles', matchmaking_mode: 'random', status: 'draft', deleted_at: null, created_at: '2026-09-23T00:00:00Z' };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SessionsPage userId="host" /></QueryClientProvider>);
}
beforeEach(async () => {
  vi.clearAllMocks(); await i18n.changeLanguage('en');
  api.listSessions.mockResolvedValue({ sessions: [], count: 0 });
  api.listActiveRoster.mockResolvedValue(roster);
  api.createSession.mockResolvedValue(session);
  api.getSessionDetail.mockResolvedValue({ participants: roster.slice(0, 2).map((p, i) => ({ id: `sp${i}`, name_snapshot: p.name })), matches: [], assignments: [] });
  api.runSessionAction.mockResolvedValue({});
  api.getHostSession.mockResolvedValue(session);
});
test('creates a draft with selected existing players and surfaces it for schedule generation', async () => {
  mount(); await screen.findByText('No sessions yet');
  await userEvent.click(screen.getAllByRole('button', { name: 'Create session' })[0]);
  const dialog = within(await screen.findByRole('dialog'));
  await userEvent.click(dialog.getByRole('button', { name: 'Save session' }));
  expect(await dialog.findByText('Enter a session name (up to 120 characters).')).toBeTruthy();
  await userEvent.type(dialog.getByLabelText('Session name'), ' Club Night ');
  await userEvent.click(dialog.getByLabelText('Player 1'));
  await userEvent.click(dialog.getByLabelText('Player 2'));
  await userEvent.click(dialog.getByRole('button', { name: 'Save session' }));
  await waitFor(() => expect(api.createSession.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ name: 'Club Night', gameMode: 'singles', playerIds: [roster[0].id, roster[1].id] })));
  expect(await screen.findByText('Session saved as a draft. Open it to generate matches.')).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Generate matches' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Generate matches' }));
  await waitFor(() => expect(api.runSessionAction).toHaveBeenCalledWith('generate_batch', { session_id: session.id, allow_overtime: false }));
});
test('a draft with too few doubles players stays open and does not call the backend', async () => {
  mount(); await screen.findByText('No sessions yet');
  await userEvent.click(screen.getAllByRole('button', { name: 'Create session' })[0]);
  const dialog = within(await screen.findByRole('dialog'));
  await userEvent.type(dialog.getByLabelText('Session name'), 'Doubles');
  await userEvent.click(dialog.getByRole('radio', { name: 'Doubles' }));
  await userEvent.click(dialog.getByLabelText('Player 1'));
  await userEvent.click(dialog.getByLabelText('Player 2'));
  await userEvent.click(dialog.getByRole('button', { name: 'Save session' }));
  expect(await dialog.findByText('Select at least 4 players.')).toBeTruthy();
  expect(api.createSession).not.toHaveBeenCalled();
});

test('the close button dismisses an unfinished session without submitting it', async () => {
  mount(); await screen.findByText('No sessions yet');
  await userEvent.click(screen.getAllByRole('button', { name: 'Create session' })[0]);
  const dialog = within(await screen.findByRole('dialog'));
  await userEvent.type(dialog.getByLabelText('Session name'), 'Unfinished session');
  await userEvent.click(dialog.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(api.createSession).not.toHaveBeenCalled();
  expect(document.body.style.overflow).not.toBe('hidden');
});
test('selected scheduled match can start, while a prior scheduled match blocks later ones', async () => {
  const upcoming = (n: number) => ({ id: `match${n}`, match_number: n, status: 'scheduled', team1_score: null, team2_score: null });
  api.listSessions.mockResolvedValue({ sessions: [{ ...session, status: 'scheduled' }], count: 1 });
  api.getSessionDetail.mockResolvedValue({ participants: [], assignments: [], matches: [upcoming(1), upcoming(2)] });
  mount(); await userEvent.click(await screen.findByRole('button', { name: /Club Night/ }));
  expect((await screen.findAllByRole('button', { name: 'Start match' })).length).toBe(1);
  await userEvent.click(screen.getByRole('button', { name: 'Start match' }));
  await waitFor(() => expect(api.runSessionAction).toHaveBeenCalledWith('start_match', { match_id: 'match1' }));
});
test('a finished score requires exactly four total points before submission', async () => {
  api.listSessions.mockResolvedValue({ sessions: [{ ...session, status: 'active' }], count: 1 });
  api.getSessionDetail.mockResolvedValue({ participants: [], assignments: [], matches: [{ id: 'm1', match_number: 1, status: 'in_progress', team1_score: 0, team2_score: 0 }] });
  mount(); await userEvent.click(await screen.findByRole('button', { name: /Club Night/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Finish match' }));
  expect(await screen.findByText('A finished match must total exactly 4 points.')).toBeTruthy();
  expect(api.runSessionAction).not.toHaveBeenCalled();
  await userEvent.clear(screen.getByLabelText('Team 1 score'));
  await userEvent.type(screen.getByLabelText('Team 1 score'), '3');
  await userEvent.clear(screen.getByLabelText('Team 2 score'));
  await userEvent.type(screen.getByLabelText('Team 2 score'), '1');
  await userEvent.click(screen.getByRole('button', { name: 'Finish match' }));
  await waitFor(() => expect(api.runSessionAction).toHaveBeenCalledWith('finish_match', { match_id: 'm1', team1_score: 3, team2_score: 1 }));
});
test('cancelling a draft requires confirmation; dismissing leaves it untouched', async () => {
  api.listSessions.mockResolvedValue({ sessions: [session], count: 1 });
  mount(); await userEvent.click(await screen.findByRole('button', { name: /Club Night/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel session' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Cancel$/ }));
  expect(api.runSessionAction).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel session' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel session' }));
  await waitFor(() => expect(api.runSessionAction).toHaveBeenCalledWith('cancel_session', { session_id: session.id }));
});
