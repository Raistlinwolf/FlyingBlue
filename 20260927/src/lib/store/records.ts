// XP transactions, credits, and archive/restore/delete for every record type.
import { type ActionResult, describeDbError, fail, noRowChanged, ok } from '@/lib/action-result';
import { getSupabase } from '@/lib/supabase/client';
import {
  type CreditInput,
  type XpTransactionInput,
  creditSchema,
  firstIssue,
  xpTransactionSchema,
} from '@/lib/validation';

const ARCHIVABLE = ['bookings', 'flight_segments', 'xp_transactions', 'credits'] as const;
export type ArchivableTable = (typeof ARCHIVABLE)[number];


export async function saveXpTransaction(id: string | null, input: XpTransactionInput): Promise<ActionResult<{ id: string }>> {
  const parsed = xpTransactionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const query = id
    ? supabase.from('xp_transactions').update(parsed.data).eq('id', id).select('id').single()
    : supabase.from('xp_transactions').insert(parsed.data).select('id').single();
  const { data, error } = await query;
  if (error) return fail(describeDbError(error));
  return ok({ id: data.id });
}

export async function saveCredit(id: string | null, input: CreditInput): Promise<ActionResult<{ id: string }>> {
  const parsed = creditSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const query = id
    ? supabase.from('credits').update(parsed.data).eq('id', id).select('id').single()
    : supabase.from('credits').insert(parsed.data).select('id').single();
  const { data, error } = await query;
  if (error) return fail(describeDbError(error));
  return ok({ id: data.id });
}

export async function duplicateXpTransaction(id: string): Promise<ActionResult<{ id: string }>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('xp_transactions').select('*').eq('id', id).single();
  if (error) return fail(describeDbError(error));
  const { data: copy, error: insertError } = await supabase
    .from('xp_transactions')
    .insert({
      booking_id: data.booking_id,
      transaction_date: data.transaction_date,
      source_type: data.source_type,
      description: data.description,
      cost: data.cost,
      currency: data.currency,
      expected_xp: data.expected_xp,
      actual_xp: null,
      status: 'Planned',
      notes: data.notes,
    })
    .select('id')
    .single();
  if (insertError) return fail(describeDbError(insertError));
  return ok({ id: copy.id });
}

/** Soft delete: the record disappears from totals but can be restored from History. */
export async function archiveRecord(table: ArchivableTable, id: string): Promise<ActionResult> {
  if (!ARCHIVABLE.includes(table)) return fail('Unknown record type.');
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).update({ archived_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  return ok(null);
}

export async function restoreRecord(table: ArchivableTable, id: string): Promise<ActionResult> {
  if (!ARCHIVABLE.includes(table)) return fail('Unknown record type.');
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).update({ archived_at: null }).eq('id', id).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  return ok(null);
}

/** Permanent delete, only allowed for records that were archived first. */
export async function deleteArchivedRecord(table: ArchivableTable, id: string): Promise<ActionResult> {
  if (!ARCHIVABLE.includes(table)) return fail('Unknown record type.');
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).delete().eq('id', id).not('archived_at', 'is', null).select('id');
  if (error) return fail(describeDbError(error));
  if (!data || data.length === 0) return fail('Archive the record before deleting it permanently.');
  return ok(null);
}
