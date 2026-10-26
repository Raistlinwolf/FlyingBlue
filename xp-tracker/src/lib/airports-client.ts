'use client';
// Airport lookups from the browser. Results are cached for the session so repeated
// XP estimates and autocomplete queries stay instant.
import type { Airport } from '@/domain/types';
import { getSupabase } from './supabase/client';

const cache = new Map<string, Airport>();
const missing = new Set<string>();

function remember(rows: Airport[]) {
  for (const a of rows) cache.set(a.iata, a);
}

export async function searchAirports(query: string): Promise<Airport[]> {
  const q = query.trim().replace(/[^\p{L}\p{N} .'-]/gu, '');
  if (q.length < 2) return [];
  const upper = q.toUpperCase();
  const { data, error } = await getSupabase()
    .from('airports')
    .select('*')
    .or(`iata.eq.${/^[A-Z]{3}$/.test(upper) ? upper : 'ZZZZ'},city.ilike.${q}%,name.ilike.%${q}%`)
    .limit(20);
  if (error || !data) return [];
  const rows = data as Airport[];
  remember(rows);
  const rank = (a: Airport) =>
    a.iata === upper ? 0 : a.city?.toUpperCase().startsWith(upper) ? 1 : a.name.toUpperCase().startsWith(upper) ? 2 : 3;
  return rows.sort((a, b) => rank(a) - rank(b) || a.iata.localeCompare(b.iata)).slice(0, 8);
}

/** Fetches the given airports (by IATA), using the cache where possible. */
export async function getAirports(codes: string[]): Promise<Map<string, Airport>> {
  const wanted = [...new Set(codes.map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c)))];
  const toFetch = wanted.filter((c) => !cache.has(c) && !missing.has(c));
  if (toFetch.length > 0) {
    const { data } = await getSupabase().from('airports').select('*').in('iata', toFetch);
    remember((data ?? []) as Airport[]);
    for (const c of toFetch) if (!cache.has(c)) missing.add(c);
  }
  return new Map(wanted.filter((c) => cache.has(c)).map((c) => [c, cache.get(c)!]));
}

export function cachedAirport(code: string): Airport | undefined {
  return cache.get(code.toUpperCase());
}
