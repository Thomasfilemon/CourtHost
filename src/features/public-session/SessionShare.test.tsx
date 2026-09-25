import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import i18n from 'i18next';
const api = vi.hoisted(() => ({ getShareDetails: vi.fn(), changeShare: vi.fn(), listSessionLeaderboard: vi.fn() }));
vi.mock('./share-api', () => api);
vi.mock('../sessions/session-api', () => ({ listSessionLeaderboard: api.listSessionLeaderboard }));
vi.mock('./use-session-live', () => ({ useSessionLive: () => 'live' }));
import '../sessions/register-translations';
import { SessionShare } from './SessionShare';
beforeEach(async () => { vi.resetAllMocks(); await i18n.changeLanguage('en'); api.getShareDetails.mockResolvedValue({ public_code: 'a'.repeat(64), realtime_token: 'b'.repeat(64), status: 'active', share_revoked_at: null }); api.listSessionLeaderboard.mockResolvedValue([]); api.changeShare.mockResolvedValue(undefined); });
function mount() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SessionShare hostId="host" sessionId="s1" /></QueryClientProvider>); }
test('revocation requires confirmation and hides the old link after success', async () => {
  mount(); await screen.findByRole('link', { name: 'Open player view' });
  await userEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
  expect(api.changeShare).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  expect(api.changeShare).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
  api.getShareDetails.mockResolvedValue({ public_code: 'a'.repeat(64), realtime_token: 'c'.repeat(64), status: 'active', share_revoked_at: 'now' });
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.changeShare).toHaveBeenCalledWith('s1', 'revoke_share'));
  await screen.findByText('The player link is revoked. Create a new link to share again.');
  expect(screen.queryByRole('link', { name: 'Open player view' })).toBeNull();
});
