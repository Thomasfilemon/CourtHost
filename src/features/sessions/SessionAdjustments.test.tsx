import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import i18n from 'i18next';
const api = vi.hoisted(() => ({ runSessionAction: vi.fn() }));
vi.mock('./session-api', () => api);
import './register-translations';
import { SessionAdjustments } from './SessionAdjustments';
import type { Session, SessionDetail } from './session-model';
const session = { id: 's1', host_id: 'host', status: 'active' } as Session;
const detail = {
  participants: [{ id: 'p1', name_snapshot: 'Alice', is_retired: false }, { id: 'p2', name_snapshot: 'Bob', is_retired: false }, { id: 'p3', name_snapshot: 'Dina', is_retired: true }],
  matches: [{ id: 'm1', match_number: 1, status: 'completed', team1_score: 3, team2_score: 1 }, { id: 'm2', match_number: 2, status: 'in_progress', team1_score: 1, team2_score: 0 }, { id: 'm3', match_number: 3, status: 'scheduled', team1_score: null, team2_score: null }],
  assignments: [{ match_id: 'm1', session_player_id: 'p1', team: 1 }, { match_id: 'm1', session_player_id: 'p2', team: 2 }, { match_id: 'm2', session_player_id: 'p2', team: 1 }, { match_id: 'm3', session_player_id: 'p1', team: 1 }],
} as SessionDetail;
beforeEach(async () => { vi.resetAllMocks(); await i18n.changeLanguage('en'); api.runSessionAction.mockResolvedValue({}); });
async function mount(status = 'active', data = detail) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(cache, 'invalidateQueries');
  render(<QueryClientProvider client={cache}><SessionAdjustments session={{ ...session, status }} detail={data} busy={false} /></QueryClientProvider>);
  if (status === 'active') await userEvent.click(screen.getByText('Session adjustments'));
  return { cache, invalidate };
}
test('correction requires confirmation and exactly four points, then refreshes the leaderboard', async () => {
  const { invalidate } = await mount();
  await userEvent.click(screen.getByRole('button', { name: 'Correct result' }));
  expect(api.runSessionAction).not.toHaveBeenCalled();
  const dialog = within(screen.getByRole('dialog'));
  await userEvent.clear(dialog.getByLabelText('Team 1 score')); await userEvent.type(dialog.getByLabelText('Team 1 score'), '4');
  await userEvent.click(dialog.getByRole('button', { name: 'Confirm corrected score' }));
  expect(await dialog.findByText('A finished match must total exactly 4 points.')).toBeTruthy();
  expect(api.runSessionAction).not.toHaveBeenCalled();
  await userEvent.clear(dialog.getByLabelText('Team 2 score')); await userEvent.type(dialog.getByLabelText('Team 2 score'), '0');
  await userEvent.click(dialog.getByRole('button', { name: 'Confirm corrected score' }));
  await waitFor(() => expect(api.runSessionAction).toHaveBeenCalledWith('correct_result', { match_id: 'm1', team1_score: 4, team2_score: 0 }));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['session-leaderboard', 'host', 's1'] }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
test('a failed correction preserves the dialog and typed scores', async () => {
  api.runSessionAction.mockRejectedValue({ code: '42501' }); await mount();
  await userEvent.click(screen.getByRole('button', { name: 'Correct result' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm corrected score' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((within(screen.getByRole('dialog')).getByLabelText('Team 1 score') as HTMLInputElement).value).toBe('3');
  expect(screen.queryByText('Result corrected. The leaderboard has been refreshed.')).toBeNull();
});
test('withdrawal counts only affected upcoming matches and cancelling the dialog never writes', async () => {
  await mount(); await userEvent.click(screen.getByRole('button', { name: 'Withdraw Alice' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Withdraw Alice? 1 upcoming matches will be cancelled. Completed results and the permanent player roster stay intact.')).toBeTruthy();
  await userEvent.click(dialog.getByRole('button', { name: 'Cancel' })); expect(api.runSessionAction).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Withdraw Alice' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.runSessionAction).toHaveBeenCalledWith('withdraw_player', { session_id: 's1', session_player_id: 'p1' }));
});
test('playing players cannot withdraw, retired players have no withdrawal action, and a playing match may be cancelled explicitly', async () => {
  await mount(); expect((screen.getByRole('button', { name: 'Withdraw Bob' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Withdraw Dina' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel playing match' }));
  expect(api.runSessionAction).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.runSessionAction).toHaveBeenCalledWith('cancel_match', { match_id: 'm2' }));
  expect(api.runSessionAction).toHaveBeenCalledTimes(1); // No automatic withdrawal or start-next side effect.
});
test.each(['draft', 'scheduled', 'completed', 'cancelled'])('adjustment controls are unavailable in %s sessions', async status => {
  await mount(status); expect(screen.queryByText('Session adjustments')).toBeNull(); expect(api.runSessionAction).not.toHaveBeenCalled();
});
test('rapid confirmation submits only one command while pending', async () => {
  let resolve!: (value: object) => void;
  api.runSessionAction.mockImplementation(() => new Promise(done => { resolve = done; }));
  await mount(); await userEvent.click(screen.getByRole('button', { name: 'Withdraw Alice' }));
  await userEvent.dblClick(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
  expect(api.runSessionAction).toHaveBeenCalledTimes(1);
  resolve({}); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
