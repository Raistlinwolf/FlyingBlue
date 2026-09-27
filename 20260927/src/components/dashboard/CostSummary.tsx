import type { Summary } from '@/domain/summary';
import { formatCostPerXp, formatMoney } from '@/lib/format';
import { Card, CardTitle, Notice } from '@/components/ui/primitives';

export function CostSummary({ summary }: { summary: Summary }) {
  const { costs, reportingCurrency: cur, unconverted } = summary;
  const m = (v: number) => formatMoney(v, cur, { decimals: 0 });
  const rows: [string, string, string?][] = [
    ['Airfare', m(costs.airfare)],
    ['SAF', m(costs.saf)],
    ['Credit-card fees', m(costs.cardFees)],
    ['Other XP spending', m(costs.otherXpCosts)],
  ];

  return (
    <Card>
      <CardTitle>Spending</CardTitle>
      <dl className="text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between py-1">
            <dt className="text-ink-2">{label}</dt>
            <dd className="tabular">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-line py-1.5 font-medium">
          <dt>Gross spending</dt>
          <dd className="tabular">{m(costs.gross)}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-ink-2">Refunds & credits</dt>
          <dd className="tabular text-good">−{m(costs.creditsIncluded)}</dd>
        </div>
        <div className="flex justify-between border-t border-line py-1.5 text-base font-semibold">
          <dt>Net cash spending</dt>
          <dd className="tabular">{m(costs.net)}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-ink-2" title="Spending above what you would have paid anyway (baseline prices)">
            Incremental XP spending
          </dt>
          <dd className="tabular">{m(costs.incremental)}</dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Cost / XP" value={formatCostPerXp(costs.costPerXp, cur)} />
        <Metric label="Incremental / XP" value={formatCostPerXp(costs.incrementalCostPerXp, cur)} />
        <Metric label="Projected / XP" value={formatCostPerXp(costs.projectedCostPerXp, cur)} hint="incl. planned & booked" />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {costs.planned > 0 ? (
          <p className="text-xs text-muted">{m(costs.planned)} planned but not yet paid is excluded from spending.</p>
        ) : null}
        {costs.creditsExcluded > 0 ? (
          <p className="text-xs text-muted">{m(costs.creditsExcluded)} in credits is not counted towards net cost.</p>
        ) : null}
        {unconverted.count > 0 ? (
          <Notice>
            {unconverted.count} amount{unconverted.count === 1 ? '' : 's'} in {unconverted.currencies.join(', ')} excluded — add an
            exchange rate to {cur} in Settings.
          </Notice>
        ) : null}
      </div>
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <p className="text-[11px] text-ink-2">{label}</p>
      <p className="text-base font-semibold">{value}</p>
      {hint ? <p className="text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}
