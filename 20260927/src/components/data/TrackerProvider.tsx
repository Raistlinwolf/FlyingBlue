'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { entryContext } from '@/lib/entry-context';
import { type Everything, loadEverything } from '@/lib/store/queries';
import { Button } from '@/components/ui/primitives';
import { storeTheme } from '@/components/ui/theme';
import { type Tracker, TrackerContext } from './tracker-context';

/**
 * Loads the user's data once and keeps it in memory. A personal tracker holds a few
 * thousand rows at most, so every view computes from this snapshot and every change
 * triggers a reload.
 */
export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Everything | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await loadEverything();
      setState(next);
      setError(null);
      storeTheme(next.settings.theme);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your data.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadEverything()
      .then((next) => {
        if (!active) return;
        setState(next);
        storeTheme(next.settings.theme);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load your data.'));
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<Tracker | null>(() => (state ? { ...state, entry: entryContext(state.data), reload } : null), [state, reload]);

  if (error && !state) {
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">Could not load your data</h1>
        <p className="mt-2 text-sm text-ink-2">{error}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="primary" onClick={reload}>
            Try again
          </Button>
          <Link href="/connect" className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium">
            Database connection
          </Link>
        </div>
      </div>
    );
  }
  if (!value) return <LoadingSkeleton />;
  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-4 h-7 w-48 rounded-lg bg-surface-2" />
      <div className="mb-4 h-32 rounded-2xl bg-surface-2" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="mt-4 h-64 rounded-2xl bg-surface-2" />
    </div>
  );
}
