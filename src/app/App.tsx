import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HostAccess } from '../features/auth/HostAccess';
// Each authenticated data query includes the current user ID in its cache key.
const queryClient = new QueryClient();
export function App() {
  return <QueryClientProvider client={queryClient}><HostAccess /></QueryClientProvider>;
}
