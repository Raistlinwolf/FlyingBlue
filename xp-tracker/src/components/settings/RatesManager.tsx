'use client';
import { useState } from 'react';
import { deleteExchangeRate, saveExchangeRate } from '@/lib/store/settings';
import type { ExchangeRate } from '@/domain/types';
import { CurrencyInput } from '@/components/forms/inputs';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Button, Field } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

/** Optional FX rates. Without a rate, foreign amounts are excluded from totals (and flagged). */
export function RatesManager({ rates, reportingCurrency, today }: { rates: ExchangeRate[]; reportingCurrency: string; today: string }) {
  const { pending, run } = useAction();
  const [d, setD] = useState({ from_currency: 'USD', rate: '', effective_from: today });
  const sorted = [...rates].sort((a, b) => a.from_currency.localeCompare(b.from_currency) || b.effective_from.localeCompare(a.effective_from));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">
        Amounts are stored in their original currency and converted to {reportingCurrency} for the dashboard using the latest rate on or before
        each transaction date.
      </p>
      {sorted.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {sorted.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="tabular">
                1 {r.from_currency} = {Number(r.rate)} {r.to_currency}
                <span className="ml-2 text-xs text-muted">from {r.effective_from}</span>
              </span>
              <ConfirmButton variant="ghost" title="Delete this rate?" confirmLabel="Delete" onConfirm={() => run(() => deleteExchangeRate(r.id), 'Rate deleted')}>
                Delete
              </ConfirmButton>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[6rem_1fr_1fr_auto]">
        <Field label="From">
          <CurrencyInput value={d.from_currency} onChange={(v) => setD({ ...d, from_currency: v })} />
        </Field>
        <Field label={`Rate (1 ${d.from_currency || '…'} = ? ${reportingCurrency})`}>
          <input className="input tabular" inputMode="decimal" placeholder="0.92" value={d.rate} onChange={(e) => setD({ ...d, rate: e.target.value.replace(/[^\d.,]/g, '') })} />
        </Field>
        <Field label="Effective from">
          <input type="date" className="input" value={d.effective_from} onChange={(e) => setD({ ...d, effective_from: e.target.value })} />
        </Field>
        <Button
          variant="primary"
          pending={pending}
          onClick={async () => {
            const r = await run(
              () =>
                saveExchangeRate({
                  from_currency: d.from_currency,
                  to_currency: reportingCurrency,
                  rate: Number(d.rate.replace(',', '.')),
                  effective_from: d.effective_from,
                }),
              'Rate saved',
            );
            if (r.ok) setD({ ...d, rate: '' });
          }}
        >
          Add rate
        </Button>
      </div>
    </div>
  );
}
