'use client';
// Reads. Row Level Security limits every query to the signed-in user's rows (or, for
// a visitor in the read-only demo, to the demo account's rows).
import type {
  Booking,
  Credit,
  ExchangeRate,
  FlightSegment,
  Note,
  QualificationCycle,
  Todo,
  TrackerData,
  UserSettings,
  XpRule,
  XpTransaction,
} from '@/domain/types';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { isDemo } from '@/lib/demo';
import { getSupabase } from '@/lib/supabase/client';
import { loadIsAdmin } from './admin';

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

export async function fetchAll<T>(table: string, orderBy = 'id'): Promise<T[]> {
  const supabase = getSupabase();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select('*').order(orderBy).order('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw Object.assign(new Error(`Loading ${table} failed: ${error.message}`), { code: error.code });
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/**
 * Like fetchAll, but null when the table does not exist yet: a database that has not
 * run a newer migration (e.g. a self-hosted one) keeps working without that feature.
 */
export async function fetchIfExists<T>(table: string, orderBy?: string): Promise<T[] | null> {
  try {
    return await fetchAll<T>(table, orderBy);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'PGRST205' || code === '42P01') return null;
    throw e;
  }
}

export interface Everything {
  data: TrackerData; // includes archived rows; views filter them
  settings: UserSettings;
  cycles: QualificationCycle[];
  rules: XpRule[];
  notes: Note[];
  todos: Todo[];
  /** False until the notes/to-dos migration has been applied to this database. */
  notesAvailable: boolean;
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
  const supabase = getSupabase();
  // Demo visitors have no session; RLS then returns the demo account's rows (read-only).
  const user = isDemo() ? null : await requireSession();
  const [bookings, segments, xpTransactions, credits, exchangeRates, cycles, rules, notes, todos, settingsRes, isAdmin] = await Promise.all([
    fetchAll<Booking>('bookings', 'purchase_date'),
    fetchAll<FlightSegment>('flight_segments', 'flight_date'),
    fetchAll<XpTransaction>('xp_transactions', 'transaction_date'),
    fetchAll<Credit>('credits', 'transaction_date'),
    fetchAll<ExchangeRate>('exchange_rates', 'effective_from'),
    fetchAll<QualificationCycle>('qualification_cycles', 'start_date'),
    fetchAll<XpRule>('xp_rules', 'effective_from'),
    fetchIfExists<Note>('notes', 'updated_at'),
    fetchIfExists<Todo>('todos', 'created_at'),
    supabase.from('user_settings').select('*').maybeSingle(),
    loadIsAdmin(),
  ]);
  if (settingsRes.error) throw new Error(`Loading settings failed: ${settingsRes.error.message}`);
  return {
    data: { bookings, segments, xpTransactions, credits, exchangeRates },
    settings: { ...DEFAULT_SETTINGS, ...(settingsRes.data ?? {}) },
    cycles,
    rules,
    notes: notes ?? [],
    todos: todos ?? [],
    notesAvailable: notes != null && todos != null,
    email: user?.email ?? null,
    userId: user?.id ?? '',
    isAdmin,
  };
}
