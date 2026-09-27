'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export interface PeriodOption {
  key: string;
  label: string;
}

/** Switch between calendar years and qualification cycles; the choice lives in ?period=. */
export function PeriodSelector({
  value,
  cycles,
  years,
  defaultCycle,
  defaultYear,
}: {
  value: string;
  cycles: PeriodOption[];
  years: PeriodOption[];
  /** Keys used when switching period type (the cycle / year containing today). */
  defaultCycle?: string;
  defaultYear: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const kind = value.startsWith('cycle:') ? 'cycle' : 'year';

  function go(key: string) {
    const next = new URLSearchParams(params);
    next.set('period', key);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? 'opacity-60' : ''}`}>
      <div role="radiogroup" aria-label="Period type" className="flex rounded-xl bg-surface-2 p-1">
        <button
          type="button"
          role="radio"
          aria-checked={kind === 'cycle'}
          disabled={cycles.length === 0}
          title={cycles.length === 0 ? 'Add a qualification cycle in Settings' : undefined}
          onClick={() => kind !== 'cycle' && cycles[0] && go(defaultCycle ?? cycles[0].key)}
          className="min-h-9 rounded-lg px-3 text-xs font-medium text-ink-2 disabled:opacity-40 aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm"
        >
          Qualification cycle
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={kind === 'year'}
          onClick={() => kind !== 'year' && go(defaultYear)}
          className="min-h-9 rounded-lg px-3 text-xs font-medium text-ink-2 aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm"
        >
          Calendar year
        </button>
      </div>
      <select className="input !min-h-10 !w-auto !py-1 text-sm" aria-label="Period" value={value} onChange={(e) => go(e.target.value)}>
        {kind === 'cycle'
          ? cycles.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))
          : years.map((y) => (
              <option key={y.key} value={y.key}>
                {y.label}
              </option>
            ))}
      </select>
    </div>
  );
}
