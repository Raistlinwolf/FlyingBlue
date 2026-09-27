'use client';
// JSON backup and Excel-friendly CSV, generated in the browser and saved as files.
import { type CsvDialect, columnsFor, toCsv } from '@/domain/csv';
import { todayIso } from '@/domain/dates';
import { BACKUP_TABLES, type CsvTable } from '@/lib/backup';
import { getSupabase } from '@/lib/supabase/client';
import { fetchAll } from './queries';

function strip(rows: Record<string, unknown>[], columns: readonly string[]) {
  return rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null])));
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildBackup(): Promise<Record<string, unknown>> {
  const backup: Record<string, unknown> = { app: 'flying-blue-xp-tracker', version: 1, exported_at: new Date().toISOString() };
  const { data: settings, error } = await getSupabase().from('user_settings').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  backup.user_settings = settings ? strip([settings], BACKUP_TABLES.user_settings)[0] : null;
  const tables = Object.keys(BACKUP_TABLES).filter((t) => t !== 'user_settings') as (keyof typeof BACKUP_TABLES)[];
  for (const table of tables) backup[table] = strip(await fetchAll<Record<string, unknown>>(table), BACKUP_TABLES[table]);
  return backup;
}

export async function downloadBackup() {
  const backup = await buildBackup();
  download(`flying-blue-backup-${todayIso()}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

export async function downloadCsv(table: CsvTable, dialect: CsvDialect) {
  const columns = BACKUP_TABLES[table] as readonly string[];
  const rows = strip(await fetchAll<Record<string, unknown>>(table), columns);
  download(`${table}-${todayIso()}.csv`, toCsv(rows, columnsFor<Record<string, unknown>>([...columns]), dialect), 'text/csv;charset=utf-8');
}
