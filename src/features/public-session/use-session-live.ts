import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
export function useSessionLive(topic: string | undefined, refresh: () => void) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const [connection, setConnection] = useState<{ topic?: string; state: string }>({ state: 'connecting' });
  useEffect(() => {
    if (!topic || !supabase) return;
    const client = supabase;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function scheduleRefresh() {
      // Coalesce row-level broadcasts from a single schedule transaction.
      if (timer || !active) return;
      timer = setTimeout(() => { timer = undefined; if (active) refreshRef.current(); }, 250);
    }
    const channel = client.channel(topic, { config: { private: false } })
      .on('broadcast', { event: 'session_changed' }, scheduleRefresh)
      .subscribe(status => {
        if (!active) return;
        setConnection({ topic, state: status === 'SUBSCRIBED' ? 'live' : 'reconnecting' });
        if (status === 'SUBSCRIBED') scheduleRefresh(); // Close the fetch/subscribe race, including reconnects.
      });
    const poll = setInterval(() => { if (document.visibilityState !== 'hidden' && navigator.onLine) scheduleRefresh(); }, 15000);
    const offline = () => setConnection({ topic, state: 'offline' });
    const online = () => { setConnection({ topic, state: 'reconnecting' }); scheduleRefresh(); };
    window.addEventListener('offline', offline); window.addEventListener('online', online);
    return () => { active = false; clearTimeout(timer); clearInterval(poll); window.removeEventListener('offline', offline); window.removeEventListener('online', online); void client.removeChannel(channel); };
  }, [topic]);
  return connection.topic === topic ? connection.state : 'connecting';
}
