'use client';
import { useRef, useState } from 'react';
import type { CsvDialect } from '@/domain/csv';
import { importBackup } from '@/lib/store/settings';
import { downloadBackup, downloadCsv } from '@/lib/store/export';
import { CSV_TABLES } from '@/lib/backup';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Button } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { useAction } from '@/components/ui/useAction';
import { ExcelImport } from './ExcelImport';

const LABELS: Record<(typeof CSV_TABLES)[number], string> = {
  bookings: 'Bookings',
  flight_segments: 'Flight segments',
  xp_transactions: 'XP transactions',
  credits: 'Credits',
  qualification_cycles: 'Qualification cycles',
};

export function DataPanel() {
  const { pending, run } = useAction();
  const toast = useToast();
  const [dialect, setDialect] = useState<CsvDialect>('standard');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function exporting(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <ExcelImport />

      <div className="border-t border-line pt-4">
        <p className="mb-2 font-medium">Full backup</p>
        <Button variant="primary" pending={busy === 'json'} onClick={() => exporting('json', downloadBackup)}>
          Download JSON backup
        </Button>
        <p className="mt-1 text-xs text-muted">Everything in your account, restorable below.</p>
      </div>

      <div>
        <p className="mb-2 font-medium">CSV for Excel</p>
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-ink-2">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="dialect" checked={dialect === 'standard'} onChange={() => setDialect('standard')} className="accent-[var(--accent)]" />
            Comma, decimal point
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="dialect" checked={dialect === 'excel-eu'} onChange={() => setDialect('excel-eu')} className="accent-[var(--accent)]" />
            Semicolon, decimal comma (Excel in NL/EU locales)
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {CSV_TABLES.map((t) => (
            <Button key={t} size="sm" pending={busy === t} onClick={() => exporting(t, () => downloadCsv(t, dialect))}>
              {LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-medium">Restore from JSON backup</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            aria-label="JSON backup file"
            className="text-xs file:mr-2 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <ConfirmButton
            variant="secondary"
            size="md"
            confirmVariant="primary"
            pending={pending}
            title="Import this backup?"
            message="Records are added or updated by their id. Nothing is deleted. Importing the same file twice is safe."
            confirmLabel="Import"
            onConfirm={async () => {
              if (!file) return;
              const text = await file.text();
              const r = await run(() => importBackup(text));
              if (r.ok) {
                const summary = Object.entries(r.data)
                  .map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`)
                  .join(', ');
                toast(`Imported ${summary || 'nothing'}`);
                setFile(null);
                if (input.current) input.current.value = '';
              }
            }}
          >
            Import
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
