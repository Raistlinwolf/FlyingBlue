'use client';
import { useEffect } from 'react';
import { asset } from '@/lib/base-path';

/** Registers the service worker in production builds only (it would cache stale dev bundles). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(asset('/sw.js'), { scope: asset('/') }).catch(() => {
      // Installability degrades gracefully; the app works without the worker.
    });
  }, []);
  return null;
}
