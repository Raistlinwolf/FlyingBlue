'use client';
import { createContext, useContext } from 'react';
import type { EntryContext } from '@/lib/entry-context';
import type { Everything } from '@/lib/store/queries';

export interface Tracker extends Everything {
  entry: EntryContext;
  /** Reloads everything from the database (called after every successful change). */
  reload: () => Promise<void>;
}

export const TrackerContext = createContext<Tracker | null>(null);

/** All of the signed-in user's data. Only usable inside the signed-in app shell. */
export function useTracker(): Tracker {
  const tracker = useContext(TrackerContext);
  if (!tracker) throw new Error('useTracker must be used inside <TrackerProvider>.');
  return tracker;
}

/** Reload function when available (no-op outside the app shell, e.g. on the login page). */
export function useReload(): () => Promise<void> {
  return useContext(TrackerContext)?.reload ?? (async () => {});
}
