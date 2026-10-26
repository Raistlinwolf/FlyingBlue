'use client';
import { useId, useState } from 'react';

export const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'DKK', 'NOK', 'PLN', 'CZK', 'HUF', 'TWD', 'JPY', 'CAD', 'AUD', 'SGD', 'HKD', 'AED'];

// SkyTeam and frequent Flying Blue partners.
export const COMMON_AIRLINES: [string, string][] = [
  ['KL', 'KLM'],
  ['AF', 'Air France'],
  ['HV', 'Transavia'],
  ['DL', 'Delta'],
  ['VS', 'Virgin Atlantic'],
  ['SK', 'SAS'],
  ['KE', 'Korean Air'],
  ['AM', 'Aeroméxico'],
  ['AR', 'Aerolíneas Argentinas'],
  ['CI', 'China Airlines'],
  ['MU', 'China Eastern'],
  ['GA', 'Garuda Indonesia'],
  ['KQ', 'Kenya Airways'],
  ['ME', 'Middle East Airlines'],
  ['SV', 'Saudia'],
  ['RO', 'TAROM'],
  ['UX', 'Air Europa'],
  ['VN', 'Vietnam Airlines'],
  ['MF', 'XiamenAir'],
  ['WS', 'WestJet'],
];

export function CurrencyInput({ value, onChange, label = 'Currency' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const id = useId();
  return (
    <>
      <input
        className="input uppercase"
        aria-label={label}
        value={value}
        list={id}
        maxLength={3}
        autoCapitalize="characters"
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
      <datalist id={id}>
        {COMMON_CURRENCIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}

export function AirlineInput({
  value,
  onChange,
  recent = [],
  label = 'Airline',
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  recent?: string[];
  label?: string;
  invalid?: boolean;
}) {
  const id = useId();
  const recentSet = new Set(recent);
  // A browser only suggests options matching the typed text, so a prefilled value hides
  // the rest of the list. While focused the box shows what is being typed (empty at
  // first, current value as placeholder); leaving it untouched keeps the current value.
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <>
      <input
        className="input uppercase"
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={typed ?? value}
        list={id}
        maxLength={40}
        placeholder={typed != null && value ? value : 'KL'}
        autoCapitalize="characters"
        onFocus={() => setTyped('')}
        onBlur={() => setTyped(null)}
        onChange={(e) => {
          const v = e.target.value.toUpperCase();
          setTyped(v);
          onChange(v);
        }}
      />
      <datalist id={id}>
        {recent.map((code) => (
          <option key={`r-${code}`} value={code} />
        ))}
        {COMMON_AIRLINES.filter(([code]) => !recentSet.has(code)).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </datalist>
    </>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[] | readonly { value: T; label: string }[];
  label: string;
}) {
  return (
    <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

/** Pill-style choice for short option lists (cabin, status) — one tap on mobile. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  short,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  label: string;
  short?: Partial<Record<T, string>>;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className="min-h-9 flex-1 rounded-lg px-2 text-xs font-medium text-ink-2 aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm"
        >
          {short?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
      <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
