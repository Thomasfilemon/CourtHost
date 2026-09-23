import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import i18n from 'i18next';
import type { Session } from '@supabase/supabase-js';

// Controlled Auth responses: no real credentials or network calls in this suite.
const fake = vi.hoisted(() => ({
  session: null as Session | null,
  listener: undefined as undefined | ((event: string, session: Session | null) => void),
  profile: vi.fn(), login: vi.fn(), logout: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock('../../lib/supabase/client', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: fake.session }, error: null }),
  onAuthStateChange: (callback: typeof fake.listener) => {
    fake.listener = callback;
    return { data: { subscription: { unsubscribe: fake.unsubscribe } } };
  },
} } }));
vi.mock('./auth-api', async importOriginal => ({
  ...await importOriginal<typeof import('./auth-api')>(),
  getHostProfile: fake.profile, signIn: fake.login, signOut: fake.logout,
}));
vi.mock('../players/PlayersPage', () => ({ PlayersPage: () => <div data-testid="players-page" /> }));
import { HostAccess } from './HostAccess';
const session = { user: { id: 'host-id', email: 'host@example.com' }, access_token: 'test-only-token' } as Session;
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><HostAccess /></QueryClientProvider>);
}
async function fillLogin() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), 'host@example.com');
  await user.type(screen.getByLabelText('Password'), 'test-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}
beforeEach(async () => {
  vi.clearAllMocks(); fake.session = null; fake.listener = undefined;
  fake.profile.mockReset().mockResolvedValue({ id: 'host-id', full_name: 'Thomas', role: 'host' });
  fake.login.mockReset().mockImplementation(async () => {
    fake.session = session; fake.listener?.('SIGNED_IN', session);
  });
  fake.logout.mockReset().mockImplementation(async () => {
    fake.session = null; fake.listener?.('SIGNED_OUT', null);
  });
  await i18n.changeLanguage('en');
});
test('signs in and shows the verified host profile', async () => {
  mount(); await fillLogin();
  expect(await screen.findByRole('heading', { name: 'Hello, Thomas.' })).toBeTruthy();
  const navbar = within(screen.getByRole('banner'));
  expect(navbar.getByRole('heading', { name: 'Hello, Thomas.' })).toBeTruthy();
  expect(navbar.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  expect(fake.login).toHaveBeenCalledWith('host@example.com', 'test-password');
  expect(fake.profile).toHaveBeenCalledWith('host-id', expect.any(AbortSignal));
});
test('wrong password stays on login and permits retry', async () => {
  fake.login.mockRejectedValue({ code: 'invalid_credentials' }); mount(); await fillLogin();
  expect((await screen.findByRole('alert')).textContent).toContain('The email or password is incorrect.');
  expect(fake.profile).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(false);
});
test('restores an existing session and checks its profile', async () => {
  fake.session = session; mount();
  expect(await screen.findByRole('heading', { name: 'Hello, Thomas.' })).toBeTruthy();
  expect(fake.login).not.toHaveBeenCalled();
});
test('does not treat an early empty initial session as signed out', async () => {
  fake.session = session;
  const originalGetSession = fake.session;
  mount();
  fake.listener?.('INITIAL_SESSION', null);
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(await screen.findByRole('heading', { name: 'Hello, Thomas.' })).toBeTruthy();
  expect(originalGetSession).toBe(session);
});
test('an authenticated account without a host profile is denied', async () => {
  fake.session = session; fake.profile.mockResolvedValue(null); mount();
  expect(await screen.findByRole('heading', { name: 'Host access required.' })).toBeTruthy();
  expect(screen.queryByTestId('players-page')).toBeNull();
});
test('profile network error can be retried', async () => {
  fake.session = session; fake.profile.mockRejectedValueOnce(new Error('offline')); mount();
  await screen.findByRole('heading', { name: 'Connection needs attention.' });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Hello, Thomas.' })).toBeTruthy();
});
test('logout removes the host screen', async () => {
  fake.session = session; mount(); await screen.findByText('Hello, Thomas.');
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
  expect(screen.queryByText('Hello, Thomas.')).toBeNull();
});
test('failed logout is visible and can be retried', async () => {
  fake.session = session; fake.logout.mockRejectedValueOnce(new Error('offline')); mount();
  await screen.findByText('Hello, Thomas.');
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Sign-out failed.');
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
});
test('late profile response after signout cannot restore host UI', async () => {
  let resolveProfile!: (value: {id: string; full_name: string; role: string}) => void;
  fake.session = session;
  fake.profile.mockImplementation(() => new Promise(resolve => { resolveProfile = resolve; }));
  mount(); await screen.findByText('Checking host access…');
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await act(async () => resolveProfile({ id: 'host-id', full_name: 'Thomas', role: 'host' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
  expect(screen.queryByText('Hello, Thomas.')).toBeNull();
});
test('Indonesian labels remain available', async () => {
  await i18n.changeLanguage('id'); const result = mount();
  expect(await screen.findByRole('button', { name: 'Masuk' })).toBeTruthy();
  result.unmount(); await waitFor(() => expect(fake.unsubscribe).toHaveBeenCalled());
});
