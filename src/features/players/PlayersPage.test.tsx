import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import i18n from 'i18next';
const api = vi.hoisted(() => ({ listPlayers: vi.fn(), runPlayerCommand: vi.fn() }));
vi.mock('./players-api', () => api);
import { PlayersPage } from './PlayersPage';
const player = { id: 'p1', name: 'Thomas', default_skill_rating: 5, is_active: true, created_at: '2026-01-01' };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PlayersPage userId="host" /></QueryClientProvider>);
}
beforeEach(async () => {
  api.listPlayers.mockReset().mockResolvedValue({ players: [player], count: 1 });
  api.runPlayerCommand.mockReset().mockResolvedValue(undefined);
  await i18n.changeLanguage('en');
});
test('search debounces and changing filters resets pagination', async () => {
  api.listPlayers.mockResolvedValue({ players: [player], count: 26 });
  mount(); await screen.findByText('Thomas');
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.listPlayers).toHaveBeenLastCalledWith({ search: '', filter: 'active', page: 1 }, expect.any(AbortSignal)));
  await userEvent.selectOptions(screen.getByLabelText('Show'), 'archived');
  await waitFor(() => expect(api.listPlayers).toHaveBeenLastCalledWith({ search: '', filter: 'archived', page: 0 }, expect.any(AbortSignal)));
  await userEvent.type(screen.getByLabelText('Search players'), 'Tho');
  await waitFor(() => expect(api.listPlayers).toHaveBeenLastCalledWith({ search: 'Tho', filter: 'archived', page: 0 }, expect.any(AbortSignal)));
});
test('add validates blank name then submits trimmed values and refetches', async () => {
  mount(); await screen.findByText('Thomas');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  const dialog = within(screen.getByRole('dialog'));
  expect((dialog.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');
  await userEvent.click(dialog.getByRole('button', { name: 'Add 1 player' }));
  expect(await dialog.findByText('Enter a name between 1 and 100 characters.')).toBeTruthy();
  expect(api.runPlayerCommand).not.toHaveBeenCalled();
  await userEvent.type(dialog.getByLabelText('Player name'), '  Maria  ');
  await userEvent.click(dialog.getByRole('button', { name: 'Add 1 player' }));
  await screen.findByText('Player added.');
  expect(api.runPlayerCommand.mock.calls[0][0]).toEqual({ action: 'create_player', data: { name: 'Maria', skill: 1 } });
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByText('Player added.')).toBeNull();
  expect(api.listPlayers.mock.calls.length).toBeGreaterThan(1);
});

test('adds multiple players with independent skills and removes unwanted entries', async () => {
  mount(); await screen.findByText('Thomas');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await userEvent.type(screen.getByLabelText('Player name'), '  Maria  ');
  await userEvent.click(screen.getByRole('button', { name: 'Add another player' }));
  expect(document.activeElement).toBe(screen.getAllByLabelText('Player name')[1]);
  await userEvent.type(screen.getAllByLabelText('Player name')[1], 'Budi');
  await userEvent.clear(screen.getAllByRole('spinbutton')[1]);
  await userEvent.type(screen.getAllByRole('spinbutton')[1], '8');
  await userEvent.click(screen.getByRole('button', { name: 'Add another player' }));
  expect((screen.getAllByRole('spinbutton')[2] as HTMLInputElement).value).toBe('1');
  await userEvent.click(screen.getByRole('button', { name: 'Remove player 3' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add 2 players' }));
  expect((await screen.findByRole('status')).textContent).toBe('2 players added.');
  expect(api.runPlayerCommand.mock.calls.map(call => call[0])).toEqual([
    { action: 'create_player', data: { name: 'Maria', skill: 1 } },
    { action: 'create_player', data: { name: 'Budi', skill: 8 } },
  ]);
});

test('validates every row before creating any players', async () => {
  mount(); await screen.findByText('Thomas');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await userEvent.type(screen.getByLabelText('Player name'), 'Maria');
  await userEvent.click(screen.getByRole('button', { name: 'Add another player' }));
  await userEvent.clear(screen.getAllByRole('spinbutton')[1]);
  await userEvent.type(screen.getAllByRole('spinbutton')[1], '11');
  await userEvent.click(screen.getByRole('button', { name: 'Add 2 players' }));
  expect(await screen.findByText('Enter a name between 1 and 100 characters.')).toBeTruthy();
  expect((screen.getAllByRole('spinbutton')[1] as HTMLInputElement).value).toBe('10');
  expect(document.activeElement).toBe(screen.getAllByLabelText('Player name')[1]);
  expect(api.runPlayerCommand).not.toHaveBeenCalled();
});

test('normalizes invalid add skill input to one and clamps values above ten', async () => {
  mount(); await screen.findByText('Thomas');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  const skill = screen.getByRole('spinbutton') as HTMLInputElement;
  await userEvent.clear(skill);
  fireEvent.blur(skill);
  expect(skill.value).toBe('1');
  await userEvent.clear(skill);
  await userEvent.type(skill, '11');
  expect(skill.value).toBe('10');
});

test('normalizes invalid edit skill input to one and clamps values above ten', async () => {
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'Edit Thomas' }));
  const skill = screen.getByRole('spinbutton') as HTMLInputElement;
  await userEvent.clear(skill);
  fireEvent.blur(skill);
  expect(skill.value).toBe('1');
  await userEvent.clear(skill);
  await userEvent.type(skill, '11');
  expect(skill.value).toBe('10');
});

test('partial failure keeps remaining inputs and never resubmits confirmed players', async () => {
  api.runPlayerCommand.mockResolvedValueOnce(undefined).mockRejectedValueOnce({ code: '23514' });
  mount(); await screen.findByText('Thomas');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await userEvent.type(screen.getByLabelText('Player name'), 'Maria');
  await userEvent.click(screen.getByRole('button', { name: 'Add another player' }));
  await userEvent.type(screen.getAllByLabelText('Player name')[1], 'Budi');
  await userEvent.click(screen.getByRole('button', { name: 'Add another player' }));
  await userEvent.type(screen.getAllByLabelText('Player name')[2], 'Sari');
  await userEvent.click(screen.getByRole('button', { name: 'Add 3 players' }));
  await screen.findByRole('alert');
  await waitFor(() => expect(screen.getAllByLabelText('Player name')).toHaveLength(2));
  expect(screen.getAllByLabelText('Player name').map(input => (input as HTMLInputElement).value)).toEqual(['Budi', 'Sari']);
  expect(api.runPlayerCommand).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('status').textContent).toBe('Player added.');
  await userEvent.click(screen.getByRole('button', { name: 'Add 2 players' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(api.runPlayerCommand.mock.calls.map(call => call[0].data.name)).toEqual(['Maria', 'Budi', 'Budi', 'Sari']);
});

test('batch submission disables duplicate saves, row changes, and closing', async () => {
  let finish!: () => void;
  api.runPlayerCommand.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  mount(); await screen.findByText('Thomas');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await userEvent.type(screen.getByLabelText('Player name'), 'Maria');
  await userEvent.click(screen.getByRole('button', { name: 'Add 1 player' }));
  for (const name of ['Saving…', 'Add another player', 'Close', 'Cancel']) {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.click(button);
  }
  expect(api.runPlayerCommand).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('Indonesian multi-player form and toast use translated copy', async () => {
  await i18n.changeLanguage('id');
  mount(); await screen.findByText('Thomas');
  await userEvent.click(screen.getByRole('button', { name: 'Tambah' }));
  await userEvent.type(screen.getByLabelText('Nama pemain'), 'Budi');
  await userEvent.click(screen.getByRole('button', { name: 'Tambah pemain lain' }));
  await userEvent.type(screen.getAllByLabelText('Nama pemain')[1], 'Sari');
  await userEvent.click(screen.getByRole('button', { name: 'Tambah 2 pemain' }));
  expect((await screen.findByRole('status')).textContent).toBe('2 pemain ditambahkan.');
});
test('edit failure retains fields and pending submission prevents duplicate writes', async () => {
  let reject!: (error: Error) => void;
  api.runPlayerCommand.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'Edit Thomas' }));
  const input = screen.getByLabelText('Player name') as HTMLInputElement;
  await userEvent.clear(input); await userEvent.type(input, 'Tom');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const pending = await screen.findByRole('button', { name: 'Saving…' });
  await userEvent.click(pending); expect(api.runPlayerCommand).toHaveBeenCalledTimes(1);
  reject(new Error('offline'));
  await screen.findByRole('alert'); expect(input.value).toBe('Tom');
  expect(screen.getByRole('dialog')).toBeTruthy();
});
test('archive requires confirmation and cancel does not write', async () => {
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'Archive Thomas' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.runPlayerCommand).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Archive Thomas' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
  await screen.findByText('Player archived.');
  expect(api.runPlayerCommand.mock.calls[0][0]).toEqual({ action: 'archive_player', data: { player_id: 'p1' } });
});
test('restore uses the existing update RPC command', async () => {
  api.listPlayers.mockResolvedValue({ players: [{ ...player, is_active: false }], count: 1 });
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'Restore Thomas' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restore' }));
  await screen.findByText('Player updated.');
  expect(api.runPlayerCommand.mock.calls[0][0]).toEqual({ action: 'update_player', data: { player_id: 'p1', is_active: true } });
});
test('referenced player cannot be permanently deleted; database error remains visible', async () => {
  api.listPlayers.mockResolvedValue({ players: [{ ...player, is_active: false }], count: 1 });
  api.runPlayerCommand.mockRejectedValue({ message: 'Referenced player must be archived' });
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'Edit Thomas' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect((await screen.findByRole('alert')).textContent).toContain('cannot be deleted');
});
test('failed list can be retried and recovers to empty state', async () => {
  api.listPlayers.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ players: [], count: 0 });
  mount(); await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Your roster is empty. Add your first player.')).toBeTruthy();
});
