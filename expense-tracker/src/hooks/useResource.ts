'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type State<T> = { data: T | null; error: string | null; loading: boolean };

/**
 * Minimal data hook: fetch on mount, refetch when the key changes, and expose
 * `reload()` so a mutation can pull fresh data. Deliberately small - the app
 * has one server and no need for a cache library.
 */
export function useResource<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: Boolean(path) });
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    const ticket = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get<T>(path);
      if (ticket === latest.current) setState({ data, error: null, loading: false });
    } catch (err) {
      if (ticket !== latest.current) return;
      const message = err instanceof ApiError ? err.message : 'Something went wrong';
      setState({ data: null, error: message, loading: false });
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load, setData: (data: T) => setState({ data, error: null, loading: false }) };
}

/** Wraps a write so components get `pending` and a single error string. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setPending(true);
    setError(null);
    setFields({});
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else {
        setError('Something went wrong');
      }
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, fields, setError };
}
