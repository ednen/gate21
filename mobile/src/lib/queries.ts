import { QueryClient, useQuery } from '@tanstack/react-query';

import { apiGet } from './api';
import type { Me, Passport } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Show the last data we had while offline instead of an error screen.
      networkMode: 'offlineFirst',
    },
  },
});

export const keys = {
  me: ['me'] as const,
  passport: ['passport'] as const,
};

export function useMe(enabled = true) {
  return useQuery({ queryKey: keys.me, queryFn: () => apiGet<Me>('/api/v1/me'), enabled });
}

export function usePassport() {
  return useQuery({ queryKey: keys.passport, queryFn: () => apiGet<Passport>('/api/v1/progress/passport') });
}

/** After progress changed (a step synced), refresh the home and passport data. */
export function invalidateProgress(): Promise<void> {
  return queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'me' || q.queryKey[0] === 'passport' });
}
