// Preferences, qualification cycles, XP rules, exchange rates and backup import.
import { validateCycle } from '@/domain/periods';
import type { QualificationCycle } from '@/domain/types';
import { type ActionResult, describeDbError, fail, ok } from '@/lib/action-result';
import { getSupabase } from '@/lib/supabase/client';
import { requireSession } from './queries';
import { BACKUP_TABLES, type BackupTable } from '@/lib/backup';
import {
  type CycleInput,
  type ExchangeRateInput,
  type SettingsInput,
  type XpRuleInput,
  cycleSchema,
  exchangeRateSchema,
  firstIssue,
  settingsSchema,
  xpRuleSchema,
} from '@/lib/validation';


export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const { id: userId } = await requireSession();
  const { error } = await supabase.from('user_settings').upsert({ user_id: userId, ...parsed.data });
  if (error) return fail(describeDbError(error));
  return ok(null);
}

// --- Qualification cycles ------------------------------------------------------

export async function saveCycle(id: string | null, input: CycleInput): Promise<ActionResult<{ id: string }>> {
  const parsed = cycleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const { data: existing, error: loadError } = await supabase.from('qualification_cycles').select('*');
  if (loadError) return fail(describeDbError(loadError));
  const clash = validateCycle({ ...parsed.data, id: id ?? undefined }, (existing ?? []) as QualificationCycle[]);
  if (clash) return fail(clash);

  const query = id
    ? supabase.from('qualification_cycles').update(parsed.data).eq('id', id).select('id').single()
    : supabase.from('qualification_cycles').insert(parsed.data).select('id').single();
  const { data, error } = await query;
  if (error) return fail(describeDbError(error));
  return ok({ id: data.id });
}

export async function deleteCycle(id: string): Promise<ActionResult> {
  // Cycles are only date ranges; deleting one never touches transactions.
  const supabase = getSupabase();
  const { error } = await supabase.from('qualification_cycles').delete().eq('id', id);
  if (error) return fail(describeDbError(error));
  return ok(null);
}

// --- XP rules ------------------------------------------------------------------

export async function saveXpRule(id: string | null, input: XpRuleInput): Promise<ActionResult> {
  const parsed = xpRuleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const { error } = id
    ? await supabase.from('xp_rules').update(parsed.data).eq('id', id)
    : await supabase.from('xp_rules').insert(parsed.data);
  if (error) return fail(describeDbError(error));
  return ok(null);
}

export async function deleteXpRule(id: string): Promise<ActionResult> {
  const supabase = getSupabase();
  const { error } = await supabase.from('xp_rules').delete().eq('id', id);
  if (error) return fail(describeDbError(error));
  return ok(null);
}

export async function installDefaultXpRules(replaceExisting: boolean): Promise<ActionResult<{ inserted: number }>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('install_default_xp_rules', { replace_existing: replaceExisting });
  if (error) return fail(describeDbError(error));
  return ok({ inserted: Number(data ?? 0) });
}

// --- Exchange rates ------------------------------------------------------------

export async function saveExchangeRate(input: ExchangeRateInput): Promise<ActionResult> {
  const parsed = exchangeRateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const { id: userId } = await requireSession();
  const { error } = await supabase
    .from('exchange_rates')
    .upsert({ user_id: userId, ...parsed.data }, { onConflict: 'user_id,from_currency,to_currency,effective_from' });
  if (error) return fail(describeDbError(error));
  return ok(null);
}

export async function deleteExchangeRate(id: string): Promise<ActionResult> {
  const supabase = getSupabase();
  const { error } = await supabase.from('exchange_rates').delete().eq('id', id);
  if (error) return fail(describeDbError(error));
  return ok(null);
}

// --- Backup import -------------------------------------------------------------

/**
 * Restores a JSON backup produced by /api/export?format=json. Rows are upserted by
 * id into the current account (user_id is always the signed-in user), in dependency
 * order, so importing the same file twice is harmless.
 */
export async function importBackup(json: string): Promise<ActionResult<Record<string, number>>> {
  let backup: Record<string, unknown>;
  try {
    backup = JSON.parse(json);
  } catch {
    return fail('The file is not valid JSON.');
  }
  if (typeof backup !== 'object' || backup == null || backup.app !== 'flying-blue-xp-tracker') {
    return fail('This does not look like a Flying Blue XP Tracker backup.');
  }
  const supabase = getSupabase();
  const { id: userId } = await requireSession();
  const counts: Record<string, number> = {};

  const settings = backup.user_settings as Record<string, unknown> | null | undefined;
  if (settings && typeof settings === 'object') {
    const row = pick(settings, BACKUP_TABLES.user_settings);
    const { error } = await supabase.from('user_settings').upsert({ ...row, user_id: userId });
    if (error) return fail(`user_settings: ${describeDbError(error)}`);
    counts.user_settings = 1;
  }

  for (const table of Object.keys(BACKUP_TABLES).filter((t) => t !== 'user_settings') as BackupTable[]) {
    const rows = backup[table];
    if (rows == null) continue;
    if (!Array.isArray(rows)) return fail(`${table} must be a list.`);
    const clean = rows
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r != null)
      .map((r) => ({ ...pick(r, BACKUP_TABLES[table]), user_id: userId }));
    for (let i = 0; i < clean.length; i += 500) {
      const { error } = await supabase.from(table).upsert(clean.slice(i, i + 500));
      if (error) return fail(`${table}: ${describeDbError(error)}`);
    }
    counts[table] = clean.length;
  }
  return ok(counts);
}

function pick(row: Record<string, unknown>, columns: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of columns) if (c in row) out[c] = row[c];
  return out;
}
