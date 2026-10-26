'use client';
// Read-only demo: a visitor without an account browses the demo account's data. The
// database enforces it (anon may only read the rows of private.app_config.demo_user_id);
// this flag only tells the app to load without a session and to explain blocked saves.
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fbxp.demo';
const CHANGE_EVENT = 'fbxp-demo-change';

export const DEMO_READ_ONLY = 'This is a read-only demo. Sign in with your own account to save changes.';

export function isDemo(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setDemo(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(STORAGE_KEY, '1');
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the demo simply does not start.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const startDemo = () => setDemo(true);
export const endDemo = () => setDemo(false);

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function useDemo(): boolean {
  return useSyncExternalStore(subscribe, isDemo, () => false);
}
