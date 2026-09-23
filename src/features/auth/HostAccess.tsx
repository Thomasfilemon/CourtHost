import { AuthLayout } from '../../app/AuthLayout';
import { HostShell } from '../../app/HostShell';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase/client';
import { useAuthSession } from './use-auth-session';
import { getHostProfile, signOut } from './auth-api';
import { LoginForm } from './LoginForm';

export function HostAccess() {
  const { t } = useTranslation();
  const { session, loading, failed } = useAuthSession();
  const cache = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const userId = session?.user.id;
  const profile = useQuery({
    // A refreshed credential forces a new authorized read. Old account data is
    // never shown while a different user's profile is being fetched.
    queryKey: ['host-profile', userId, session?.expires_at],
    queryFn: ({ signal }) => getHostProfile(userId!, signal),
    enabled: Boolean(userId), retry: false, staleTime: 0, gcTime: 0,
  });
  async function logout() {
    setLeaving(true); setLogoutFailed(false);
    try { await signOut(); cache.clear(); }
    catch { setLogoutFailed(true); }
    finally { setLeaving(false); }
  }
  const logoutButton = <button className="secondary-button" onClick={() => void logout()} disabled={leaving}>{t(leaving ? 'auth.signingOut' : 'auth.signOut')}</button>;
  if (!supabase) return <AuthLayout><section className="auth-card"><h1>{t('auth.configTitle')}</h1><p>{t('auth.configBody')}</p></section></AuthLayout>;
  if (loading) return <AuthLayout><section className="auth-card" role="status"><p>{t('auth.checkingSession')}</p></section></AuthLayout>;
  if (failed) return <AuthLayout><section className="auth-card"><p role="alert">{t('auth.sessionFailed')}</p><button className="secondary-button" onClick={() => window.location.reload()}>{t('auth.retry')}</button></section></AuthLayout>;
  if (!session) return <AuthLayout><LoginForm /></AuthLayout>;
  if (profile.data && !profile.isError) return <HostShell userId={session.user.id} name={profile.data.full_name} logoutButton={logoutButton} logoutFailed={logoutFailed} />;
  return <AuthLayout><section className="auth-card" aria-busy={profile.isFetching || leaving}>
    {profile.isPending ? <p role="status">{t('auth.checkingProfile')}</p> : profile.isError ? <>
      <h1>{t('auth.profileFailedTitle')}</h1><p role="alert">{t('auth.profileFailed')}</p>
      <button className="secondary-button" onClick={() => void profile.refetch()} disabled={profile.isFetching}>{t('auth.retry')}</button>
    </> : !profile.data ? <>
      <h1>{t('auth.deniedTitle')}</h1><p role="alert">{t('auth.deniedBody')}</p>
    </> : null}
    <div className="auth-actions">{logoutButton}</div>
    {logoutFailed && <p className="auth-error" role="alert">{t('auth.logoutFailed')}</p>}
  </section></AuthLayout>;
}
