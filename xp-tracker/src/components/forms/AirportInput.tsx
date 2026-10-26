'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { Airport } from '@/domain/types';
import { cachedAirport, searchAirports } from '@/lib/airports-client';

/**
 * IATA code input with autocomplete by code, city or airport name. Recent airports
 * appear as soon as the field is focused.
 */
export function AirportInput({
  value,
  onChange,
  recent = [],
  placeholder = 'AMS',
  invalid,
  autoFocus,
  label,
}: {
  value: string;
  onChange: (code: string) => void;
  recent?: string[];
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Airport[]>([]);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const requestId = useRef(0);

  const query = value.trim();
  const showRecent = open && query.length < 2 && recent.length > 0;

  useEffect(() => {
    if (!open || query.length < 2) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const found = await searchAirports(query);
      if (id === requestId.current) {
        setResults(found);
        setHighlight(0);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open]);

  const options: { code: string; label: string }[] = showRecent
    ? recent.map((code) => ({ code, label: describe(code) }))
    : open && query.length >= 2
      ? results.map((a) => ({ code: a.iata, label: `${a.city ?? ''}${a.city ? ' · ' : ''}${a.name}` }))
      : [];

  function choose(code: string) {
    onChange(code);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        className="input font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={options.length > 0}
        role="combobox"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus={autoFocus}
        maxLength={40}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120);
          if (/^[a-z]{3}$/i.test(query)) onChange(query.toUpperCase());
        }}
        onChange={(e) => {
          const next = e.target.value;
          onChange(/^[a-z]{0,3}$/i.test(next) ? next.toUpperCase() : next);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (options.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && !/^[A-Z]{3}$/.test(query)) {
            e.preventDefault();
            choose(options[highlight]?.code ?? query);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {options.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 min-w-56 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {showRecent ? <li className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted">Recent</li> : null}
          {options.map((o, i) => (
            <li
              key={o.code}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.code);
              }}
              className="flex cursor-pointer items-baseline gap-2 rounded-lg px-2 py-2 text-sm aria-selected:bg-surface-2"
            >
              <span className="font-mono font-semibold">{o.code}</span>
              <span className="truncate text-ink-2">{o.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function describe(code: string): string {
  const a = cachedAirport(code);
  return a ? (a.city ?? a.name) : '';
}
