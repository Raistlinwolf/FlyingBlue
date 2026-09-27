'use client';
// Reads. Row Level Security limits every query to the signed-in user's rows.
import type {
  Booking,
  Credit,
  ExchangeRate,
  FlightSegment,
  QualificationCycle,
  TrackerData,
  UserSettings,
  XpRule,
  XpTransaction,
} from '@/domain/types';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { getSupabase } from '@/lib/supabase/client';
import { loadIsAdmin } from './admin';

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

export async function fetchAll<T>(table: string, orderBy = 'id'): Promise<T[]> {
  const supabase = getSupabase();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select('*').order(orderBy).order('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Loading ${table} failed: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export interface Everything {
  data: TrackerData; // includes archived rows; views filter them
  settings: UserSettings;
  cycles: QualificationCycle[];
  rules: XpRule[];
  email: string | null;
  userId: string;
  isAdmin: boolean;
}

export async function requireSession() {
  const { data } = await getSupabase().auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error('Your session has expired. Please sign in again.');
  return user;
}

export async function loadEverything(): Promise<Everything> {
  const user = await requireSession();
  const supabase = getSupabase();
  const [bookings, segments, xpTransactions, credits, exchangeRates, cycles, rules, settingsRes, isAdmin] = await Promise.all([
    fetchAll<Booking>('bookings', 'purchase_date'),
    fetchAll<FlightSegment>('flight_segments', 'flight_date'),
    fetchAll<XpTransaction>('xp_transactions', 'transaction_date'),
    fetchAll<Credit>('credits', 'transaction_date'),
    fetchAll<ExchangeRate>('exchange_rates', 'effective_from'),
    fetchAll<QualificationCycle>('qualification_cycles', 'start_date'),
    fetchAll<XpRule>('xp_rules', 'effective_from'),
    supabase.from('user_settings').select('*').maybeSingle(),
    loadIsAdmin(),
  ]);
  if (settingsRes.error) throw new Error(`Loading settings failed: ${settingsRes.error.message}`);
  return {
    data: { bookings, segments, xpTransactions, credits, exchangeRates },
    settings: { ...DEFAULT_SETTINGS, ...(settingsRes.data ?? {}) },
    cycles,
    rules,
    email: user.email ?? null,
    userId: user.id,
    isAdmin,
  };
}
