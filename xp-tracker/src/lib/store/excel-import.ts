'use client';
// Reads the "Earning Log" sheet of the original Excel tracker in the browser and
// writes the resulting plan to the database. The file never leaves this device
// except as rows in your own Supabase database.
import { type ImportPlan, type SuggestedCycle, parseEarningLog } from '@/domain/earning-log';
import { type ActionResult, describeDbError, fail, ok } from '@/lib/action-result';
import { getSupabase } from '@/lib/supabase/client';

export async function readEarningLog(file: File) {
  const XLSX = await import('xlsx'); // loaded only when importing
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  const names = workbook.SheetNames;
  const preferred = names.find((n) => /earning\s*log/i.test(n));
  for (const name of preferred ? [preferred, ...names.filter((n) => n !== preferred)] : names) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
    const parsed = parseEarningLog(rows);
    if (parsed.rows.length > 0) return { sheet: name, ...parsed };
  }
  return { sheet: null, rows: [], warnings: ['No sheet with an Earning Log layout (日期 / 起飛 / 降落 / 飛行XP …) was found.'] };
}

async function upsertChunks(table: string, rows: object[]) {
  const supabase = getSupabase();
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500));
    if (error) throw Object.assign(new Error(`${table}: ${describeDbError(error)}`), { code: error.code });
  }
}

/**
 * Upserts bookings, segments and XP transactions (ids are stable, so re-importing
 * updates). Cycles are inserted too; with `replaceCycles` the existing cycles are
 * deleted first (records are untouched — cycles are only date ranges).
 */
export async function applyImport(
  plan: ImportPlan,
  cycles: SuggestedCycle[],
  options: { replaceCycles: boolean },
): Promise<ActionResult<{ bookings: number; flights: number; xp: number; cycles: number }>> {
  try {
    await upsertChunks('bookings', plan.bookings);
    await upsertChunks('flight_segments', plan.segments);
    await upsertChunks('xp_transactions', plan.xpTransactions);
    if (cycles.length > 0) {
      const supabase = getSupabase();
      if (options.replaceCycles) {
        const { error } = await supabase.from('qualification_cycles').delete().not('id', 'is', null);
        if (error) return fail(describeDbError(error));
      }
      await upsertChunks('qualification_cycles', cycles);
    }
    return ok({ bookings: plan.bookings.length, flights: plan.segments.length, xp: plan.xpTransactions.length, cycles: cycles.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed.';
    return fail(/overlap/.test(message) ? `${message} Tick “Replace my existing cycles” or delete them first.` : message);
  }
}
