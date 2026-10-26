import type { Summary } from '@/domain/summary';
import { formatCostPerXp, formatMoney, formatXp } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/primitives';

/**
 * XP by source as horizontal bars (actual solid, booked lighter), with cost and
 * cost per XP alongside — the numbers are always visible, so the bars never gate them.
 */
export function SourceBreakdown({ summary, className = '' }: { summary: Summary; className?: string }) {
  const cur = summary.reportingCurrency;
  const rows = summary.sources;
  const max = Math.max(...rows.map((r) => r.actualXp + r.bookedXp), 1);

  return (
    <Card className={className}>
      <CardTitle>XP by source</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="pb-2 font-medium">Source</th>
              <th className="w-[40%] pb-2 font-medium">
                <span className="sr-only">Bar</span>
              </th>
              <th className="pb-2 text-right font-medium">XP</th>
              <th className="pb-2 text-right font-medium">Cost</th>
              <th className="pb-2 text-right font-medium">Per XP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const actualW = (Math.max(r.actualXp, 0) / max) * 100;
              const bookedW = (Math.max(r.bookedXp, 0) / max) * 100;
              const muted = r.actualXp === 0 && r.bookedXp === 0 && r.cost === 0;
              return (
                <tr key={r.key} className={`border-t border-line ${muted ? 'text-muted' : ''}`}>
                  <td className="py-2 pr-2">{r.label}</td>
                  <td className="py-2 pr-3">
                    <div
                      className="flex h-3 gap-[2px]"
                      title={`${r.label}: ${r.actualXp} actual, ${r.bookedXp} booked`}
                      role="img"
                      aria-label={`${r.actualXp} actual and ${r.bookedXp} booked XP`}
                    >
                      {actualW > 0 ? <div className="h-full rounded-l-[4px] bg-xp-actual last:rounded-r-[4px]" style={{ width: `${actualW}%` }} /> : null}
                      {bookedW > 0 ? <div className="h-full rounded-r-[4px] bg-xp-booked first:rounded-l-[4px]" style={{ width: `${bookedW}%` }} /> : null}
                    </div>
                  </td>
                  <td className="py-2 text-right tabular">
                    <span className="font-medium">{formatXp(r.actualXp)}</span>
                    {r.bookedXp !== 0 ? <span className="text-muted"> +{formatXp(r.bookedXp)}</span> : null}
                  </td>
                  <td className="py-2 pl-2 text-right tabular">{r.cost === 0 ? '—' : formatMoney(r.cost, cur, { decimals: 0 })}</td>
                  <td className="py-2 pl-2 text-right tabular">{formatCostPerXp(r.costPerXp, cur)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        <span className="mr-1 inline-block size-2 rounded-sm bg-xp-actual align-middle" /> actual
        <span className="ml-3 mr-1 inline-block size-2 rounded-sm bg-xp-booked align-middle" /> booked · flight cost is net of refunds linked to
        bookings
      </p>
    </Card>
  );
}
