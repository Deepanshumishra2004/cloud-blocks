// Fetches and mutates the signed-in user's repls via the backend API.
import { useCallback, useEffect, useState } from 'react';

import { api, ApiError } from '@/lib/api';
import type { Repl } from '../app-types';

export function useRepls() {
  const [repls, setRepls] = useState<Repl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRepls(await api.getRepls());
    } catch (err) {
      // Subscription gate returns 403 — surface a friendly message.
      if (err instanceof ApiError && err.status === 403) {
        setError('An active subscription is required to view repls.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load repls');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (name: string, type: Repl['type']) => {
    const repl = await api.createRepl(name, type);
    setRepls((prev) => [repl, ...prev]);
    return repl;
  }, []);

  return { repls, loading, error, reload: load, create };
}
