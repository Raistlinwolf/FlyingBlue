'use client';
// The app is a static site: it talks to Supabase straight from the browser and Row
// Level Security protects the data. The Supabase URL and publishable key are entered
// on the Connect screen and kept in this browser (localStorage), so no connection
// details have to be baked into the public build. Build-time env vars still work as
// a default for hosted setups.
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

export interface SupabaseConfig {
  url: string;
  key: string;
}

const STORAGE_KEY = 'fbxp.supabase';
const CHANGE_EVENT = 'fbxp-config-change';
let client: SupabaseClient | undefined;
let clientFor: string | undefined;

function envConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function getConfig(): SupabaseConfig | null {
  if (typeof window === 'undefined') return envConfig();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SupabaseConfig;
      if (parsed.url && parsed.key) return parsed;
    }
  } catch {
    // Storage unavailable (private mode): fall back to the build-time values.
  }
  return envConfig();
}

export function saveConfig(config: SupabaseConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: config.url.replace(/\/+$/, ''), key: config.key.trim() }));
  client = undefined;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearConfig() {
  window.localStorage.removeItem(STORAGE_KEY);
  client = undefined;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export class NotConfiguredError extends Error {
  constructor() {
    super('No database connection configured.');
  }
}

export function getSupabase(): SupabaseClient {
  const config = getConfig();
  if (!config) throw new NotConfiguredError();
  const id = `${config.url}|${config.key}`;
  if (!client || clientFor !== id) {
    client = createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    clientFor = id;
  }
  return client;
}

/** Checks that a URL + key point at a reachable Supabase Auth service. */
export async function testConnection(config: SupabaseConfig): Promise<string | null> {
  try {
    const res = await fetch(`${config.url.replace(/\/+$/, '')}/auth/v1/health`, { headers: { apikey: config.key } });
    if (res.ok) return null;
    if (res.status === 401) return 'The key was rejected. Use the publishable (or anon) key.';
    return `Supabase answered with HTTP ${res.status}.`;
  } catch {
    return 'Could not reach that URL. Is Supabase running, and did you allow this site to access local network devices?';
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The saved connection; `undefined` while prerendering (before the browser is known). */
export function useConfig(): SupabaseConfig | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(getConfig()),
    () => 'prerender',
  );
  return raw === 'prerender' ? undefined : (JSON.parse(raw) as SupabaseConfig | null);
}
