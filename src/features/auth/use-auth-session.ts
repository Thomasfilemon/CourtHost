import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';

type AuthState = { session: Session | null; loading: boolean; failed: boolean };
export function useAuthSession() {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, failed: false });
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let revision = 0;
    let initialized = false;
    const timeout = setTimeout(() => {
      if (active) setState({ session: null, loading: false, failed: true });
    }, 16000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Keep this callback synchronous: database requests run in TanStack Query.
      // getSession is the authoritative initial read. Supabase can emit
      // INITIAL_SESSION with null before that read has restored a session.
      if (_event === 'INITIAL_SESSION' && !initialized) return;
      revision++;
      clearTimeout(timeout);
      if (active) setState({ session, loading: false, failed: false });
    });
    const initialRevision = revision;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || revision !== initialRevision) return;
      clearTimeout(timeout);
      initialized = true;
      setState({ session: error ? null : data.session, loading: false, failed: Boolean(error) });
    }).catch(() => {
      if (!active || revision !== initialRevision) return;
      clearTimeout(timeout);
      initialized = true;
      setState({ session: null, loading: false, failed: true });
    });
    return () => { active = false; clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);
  return state;
}
