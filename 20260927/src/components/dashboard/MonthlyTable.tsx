import type { CounterMonth } from '@/domain/qualification';
import type { MonthRow } from '@/domain/summary';
import { formatMonthLabel } from '@/domain/dates';
import { formatMoney, formatXp } from '@/lib/format';

/**
 * Month-by-month figures; the inline bar shows earned (solid) and booked (lighter) XP.
 * "QC counter" is the qualification-cycle XP counter (credited / incl. booked).
 */
export function MonthlyTable({ months, counter, currency }: { months: MonthRow[]; counter: CounterMonth[]; currency: string }) {
  const byMonth = new Map(counter.map((c) => [c.month, c]));
  const max = Math.max(...months.map((m) => m.actualXp + m.bookedXp), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="pb-2 font-medium">Month</th>
            <th className="w-[28%] pb-2 font-medium">
              <span className="sr-only">XP bar</span>
            </th>
            <th className="pb-2 text-right font-medium">Earned</th>
            <th className="pb-2 text-right font-medium">Booked</th>
            <th className="pb-2 text-right font-medium">QC counter</th>
            <th className="pb-2 text-right font-medium">Flights</th>
            <th className="pb-2 text-right font-medium">Spending</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {months.map((m) => {
            const empty = m.actualXp === 0 && m.bookedXp === 0 && m.spending === 0 && m.segments === 0;
            return (
              <tr key={m.month} className={`border-t border-line ${empty ? 'text-muted' : ''}`}>
                <td className="py-1.5 pr-2 whitespace-nowrap">{formatMonthLabel(m.month, 'short')}</td>
                <td className="py-1.5 pr-3">
                  <div className="flex h-2.5 gap-[2px]" aria-hidden>
                    {m.actualXp > 0 ? <div className="rounded-l-[3px] bg-xp-actual last:rounded-r-[3px]" style={{ width: `${(m.actualXp / max) * 100}%` }} /> : null}
                    {m.bookedXp > 0 ? <div className="rounded-r-[3px] bg-xp-booked first:rounded-l-[3px]" style={{ width: `${(m.bookedXp / max) * 100}%` }} /> : null}
                  </div>
                </td>
                <td className="py-1.5 text-right">{m.actualXp ? formatXp(m.actualXp) : '—'}</td>
                <td className="py-1.5 text-right">{m.bookedXp ? `+${formatXp(m.bookedXp)}` : '—'}</td>
                <td className="py-1.5 text-right">
                  <CounterCell c={byMonth.get(m.month)} />
                </td>
                <td className="py-1.5 text-right">{m.segments || '—'}</td>
                <td className="py-1.5 text-right">{m.spending ? formatMoney(m.spending, currency, { decimals: 0 }) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CounterCell({ c }: { c: CounterMonth | undefined }) {
  if (!c) return <>—</>;
  const total = c.credited + c.booked;
  return (
    <>
      {c.qcStart ? <span className="mr-1 rounded bg-surface-2 px-1 text-[10px] font-medium text-ink-2">{c.status}</span> : null}
      {formatXp(c.credited)}
      {c.booked ? <span className="text-muted"> / {formatXp(total)}</span> : null}
    </>
  );
}
