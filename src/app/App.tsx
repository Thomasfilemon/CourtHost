import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicSessionPage } from '../features/public-session/PublicSessionPage';
import { HostAccess } from '../features/auth/HostAccess';
// Each authenticated data query includes the current user ID in its cache key.
const queryClient = new QueryClient();
export function App() {
  const publicRoute = (typeof window === 'undefined' ? '' : window.location.pathname).match(/^\/s\/([^/]+)\/?$/);
  return <QueryClientProvider client={queryClient}><>{publicRoute ? <PublicSessionPage key={publicRoute[1]} token={publicRoute[1]} /> : <HostAccess />}</></QueryClientProvider>;
}
