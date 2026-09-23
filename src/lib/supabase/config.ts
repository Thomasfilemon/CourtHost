// VITE_ variables are visible in the browser. Only a publishable key belongs here.
export function readSupabaseConfig(url?: string, key?: string) {
  const cleanUrl = url?.trim();
  const cleanKey = key?.trim();
  if (!cleanUrl || !cleanKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(cleanKey)) return null;
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null;
    return { url: parsed.origin, key: cleanKey };
  } catch { return null; }
}
