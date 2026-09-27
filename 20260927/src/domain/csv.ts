// CSV serialisation that opens cleanly in Excel: UTF-8 BOM, CRLF line endings,
// quoted fields. The "excel-eu" dialect uses ';' and decimal commas, which is what
// Excel expects in most European locales.
export type CsvDialect = 'standard' | 'excel-eu';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function formatCell(value: string | number | boolean | null | undefined, dialect: CsvDialect): string {
  if (value == null) return '';
  let text: string;
  if (typeof value === 'number') text = dialect === 'excel-eu' ? String(value).replace('.', ',') : String(value);
  else if (typeof value === 'boolean') text = value ? 'TRUE' : 'FALSE';
  else text = value;
  const delimiter = dialect === 'excel-eu' ? ';' : ',';
  // Quote when needed; also guard against spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;
  if (text.includes(delimiter) || text.includes('"') || /[\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], dialect: CsvDialect = 'standard'): string {
  const delimiter = dialect === 'excel-eu' ? ';' : ',';
  const lines = [columns.map((c) => formatCell(c.header, dialect)).join(delimiter)];
  for (const row of rows) lines.push(columns.map((c) => formatCell(c.value(row), dialect)).join(delimiter));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Builds columns straight from a list of object keys. */
export function columnsFor<T extends object>(keys: (keyof T & string)[]): CsvColumn<T>[] {
  return keys.map((key) => ({
    header: key,
    value: (row: T) => {
      const v = row[key] as unknown;
      if (v == null) return null;
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
      return JSON.stringify(v);
    },
  }));
}
