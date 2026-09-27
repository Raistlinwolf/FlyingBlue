'use client';
import { useMemo, useState } from 'react';
import { formatDate, todayIso } from '@/domain/dates';
import {
  type EarningLogRow,
  creditedXpEvents,
  planImport,
  suggestCycles,
} from '@/domain/earning-log';
import { FB_STATUSES, type FlyingBlueStatus } from '@/domain/types';
import { formatMoney } from '@/lib/format';
import { applyImport, readEarningLog } from '@/lib/store/excel-import';
import { useTracker } from '@/components/data/tracker-context';
import { Toggle } from '@/components/forms/inputs';
import { Button, Field, Notice } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

/**
 * Import the "Earning Log" sheet of the original Excel tracker. The file is read in
 * the browser; a preview shows what will be created before anything is written.
 */
export function ExcelImport() {
  const { settings, cycles: existingCycles } = useTracker();
  const { pending, run } = useAction();
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState<{ sheet: string | null; rows: EarningLogRow[]; warnings: string[]; file: string } | null>(null);
  const [airline, setAirline] = useState(settings.default_airline ?? '');
  const [withCycles, setWithCycles] = useState(true);
  const [replaceCycles, setReplaceCycles] = useState(false);
  const [startStatus, setStartStatus] = useState<FlyingBlueStatus>('Explorer');
  const [startMonth, setStartMonth] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const today = todayIso();
  const plan = useMemo(
    () =>
      parsed
        ? planImport(parsed.rows, {
            today,
            currency: settings.preferred_currency,
            category: settings.default_category,
            airline: airline.trim().toUpperCase() || 'UNKNOWN',
          })
        : null,
    [parsed, today, settings.preferred_currency, settings.default_category, airline],
  );
  const firstMonth = useMemo(() => {
    if (!plan) return '';
    const dates = [...plan.segments.map((s) => s.flight_date), ...plan.xpTransactions.map((t) => t.transaction_date)].sort();
    return dates[0]?.slice(0, 7) ?? '';
  }, [plan]);
  const cycles = useMemo(
    () => (plan && withCycles ? suggestCycles(creditedXpEvents(plan), { startStatus, startMonth: startMonth || firstMonth, today }) : []),
    [plan, withCycles, startStatus, startMonth, firstMonth, today],
  );

  async function onFile(file: File | undefined) {
    setDone(null);
    if (!file) return setParsed(null);
    setReading(true);
    try {
      setParsed({ ...(await readEarningLog(file)), file: file.name });
    } catch (e) {
      setParsed({ sheet: null, rows: [], warnings: [e instanceof Error ? e.message : 'Could not read the file.'], file: file.name });
    } finally {
      setReading(false);
    }
  }

  const flightsXp = plan?.segments.reduce((a, s) => ({ actual: a.actual + (s.actual_xp ?? 0), booked: a.booked + (s.actual_xp == null ? s.expected_xp : 0) }), { actual: 0, booked: 0 });
  const otherXp = plan?.xpTransactions.reduce((a, t) => a + t.expected_xp, 0) ?? 0;
  const spend = plan ? plan.bookings.reduce((a, b) => a + b.total_price, 0) + plan.xpTransactions.reduce((a, t) => a + t.cost, 0) : 0;

  return (
    <div>
      <p className="mb-1 font-medium">Import from Excel</p>
      <p className="mb-2 text-xs text-muted">
        Reads the <strong>Earning Log</strong> sheet (年度 · 分類 · 日期 · 起飛 · 降落 · 價格 · 飛行XP · SAF · 信用卡 · 其他XP). The file stays
        on this device; only the resulting rows are saved to your database. Importing the same sheet again updates instead of duplicating.
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="Excel file"
        className="text-xs file:mr-2 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {reading ? <p className="mt-2 text-xs text-muted">Reading…</p> : null}

      {parsed && plan ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-line p-3">
          {parsed.rows.length === 0 ? (
            <Notice>{parsed.warnings[0] ?? 'Nothing to import.'}</Notice>
          ) : (
            <>
              <p className="text-sm">
                <strong>{parsed.file}</strong> · sheet “{parsed.sheet}”: {plan.bookings.length} bookings, {plan.segments.length} flights,{' '}
                {plan.xpTransactions.length} other XP entries.
              </p>
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Stat label="Flight XP credited" value={String(flightsXp?.actual ?? 0)} />
                <Stat label="Flight XP booked" value={`+${flightsXp?.booked ?? 0}`} />
                <Stat label="SAF / card / other XP" value={String(otherXp)} />
                <Stat label="Spending" value={formatMoney(spend, settings.preferred_currency, { decimals: 0 })} />
              </dl>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Airline for imported flights" hint="The sheet has no airline column; edit flights later if needed.">
                  <input className="input uppercase" value={airline} placeholder="UNKNOWN" maxLength={40} onChange={(e) => setAirline(e.target.value)} />
                </Field>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-ink-2">Show bookings to be created</summary>
                <ul className="mt-2 max-h-64 divide-y divide-line overflow-auto rounded-lg border border-line">
                  {plan.bookings.map((b) => {
                    const segs = plan.segments.filter((s) => s.booking_id === b.id);
                    return (
                      <li key={b.id} className="flex justify-between gap-2 px-2 py-1.5">
                        <span className="min-w-0">
                          <span className="font-mono">{b.booking_name}</span>
                          <span className="block text-muted">
                            {formatDate(segs[0].flight_date)} · {segs.length} flight{segs.length === 1 ? '' : 's'} · {b.status}
                          </span>
                        </span>
                        <span className="shrink-0 tabular">{formatMoney(b.total_price, b.currency)}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>

              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <Toggle
                  label="Also create qualification cycles"
                  hint="Rebuilt from credited XP: a new cycle starts the month after reaching the next level, with the surplus carried over."
                  checked={withCycles}
                  onChange={setWithCycles}
                />
                {withCycles ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Status at the start">
                        <select className="input" value={startStatus} onChange={(e) => setStartStatus(e.target.value as FlyingBlueStatus)}>
                          {FB_STATUSES.filter((s) => s !== 'Ultimate').map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="First cycle starts">
                        <input type="month" className="input" value={startMonth || firstMonth} onChange={(e) => setStartMonth(e.target.value)} />
                      </Field>
                    </div>
                    <ul className="rounded-lg border border-line text-xs">
                      {cycles.map((c) => (
                        <li key={c.id} className="flex flex-wrap justify-between gap-2 border-b border-line px-2 py-1.5 last:border-0">
                          <span className="font-medium">{c.starting_status}</span>
                          <span className="text-ink-2">
                            {formatDate(c.start_date)} – {formatDate(c.end_date)}
                          </span>
                          <span className="tabular text-muted">
                            target {c.target_xp}
                            {c.carried_over_xp ? ` · carried over ${c.carried_over_xp}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {existingCycles.length > 0 ? (
                      <Toggle
                        label="Replace my existing cycles"
                        hint={`Deletes your ${existingCycles.length} current cycle definition(s) first. Flights and XP are not affected.`}
                        checked={replaceCycles}
                        onChange={setReplaceCycles}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>

              {[...parsed.warnings, ...plan.warnings].length > 0 ? (
                <Notice>
                  <ul className="list-disc pl-4">
                    {[...parsed.warnings, ...plan.warnings].map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Notice>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                {done ? <span className="text-xs text-good">{done}</span> : null}
                <Button
                  variant="primary"
                  pending={pending}
                  onClick={async () => {
                    const r = await run(() => applyImport(plan, cycles, { replaceCycles }), 'Excel data imported');
                    if (r.ok) setDone(`Imported ${r.data.bookings} bookings, ${r.data.flights} flights, ${r.data.xp} XP entries, ${r.data.cycles} cycles.`);
                  }}
                >
                  Import {plan.segments.length} flights
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular">{value}</dd>
    </div>
  );
}
