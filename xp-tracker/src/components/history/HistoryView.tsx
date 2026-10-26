'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { routingLines, sortSegments } from '@/domain/bookings';
import { formatDate } from '@/domain/dates';
import type { Period } from '@/domain/periods';
import { calendarYearPeriod, cyclePeriod, isDateInPeriod } from '@/domain/periods';
import {
  BOOKING_CATEGORIES,
  type Booking,
  type FlightSegment,
  type QualificationCycle,
  TRAVEL_STATUSES,
  type TrackerData,
  XP_SOURCE_TYPES,
  XP_TRANSACTION_STATUSES,
} from '@/domain/types';
import { segmentXp, transactionXp } from '@/domain/xp';
import { formatMoney } from '@/lib/format';
import { EmptyState, StatusBadge, XpBadge } from '@/components/ui/primitives';
import { RecordActions } from './RecordActions';

type Tab = 'bookings' | 'flights' | 'xp' | 'credits';
const TABS: { key: Tab; label: string }[] = [
  { key: 'bookings', label: 'Bookings' },
  { key: 'flights', label: 'Flights' },
  { key: 'xp', label: 'XP' },
  { key: 'credits', label: 'Credits' },
];

interface Filters {
  period: string; // '' | year:YYYY | cycle:id
  category: string;
  airline: string;
  origin: string;
  destination: string;
  source: string;
  status: string;
  query: string;
  archived: boolean;
}

export function HistoryView({
  data,
  cycles,
  years,
  initialTab,
  initialQuery,
}: {
  data: TrackerData;
  cycles: QualificationCycle[];
  years: number[];
  initialTab: Tab;
  initialQuery: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [f, setF] = useState<Filters>({
    period: '',
    category: '',
    airline: '',
    origin: '',
    destination: '',
    source: '',
    status: '',
    query: initialQuery,
    archived: false,
  });
  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));

  const period: Period | null = useMemo(() => {
    if (f.period.startsWith('year:')) return calendarYearPeriod(Number(f.period.slice(5)));
    if (f.period.startsWith('cycle:')) {
      const c = cycles.find((x) => x.id === f.period.slice(6));
      return c ? cyclePeriod(c) : null;
    }
    return null;
  }, [f.period, cycles]);

  const bookingsById = useMemo(() => new Map(data.bookings.map((b) => [b.id, b])), [data.bookings]);
  const segmentsByBooking = useMemo(() => {
    const map = new Map<string, FlightSegment[]>();
    for (const s of data.segments) map.set(s.booking_id, [...(map.get(s.booking_id) ?? []), s]);
    for (const [k, v] of map) map.set(k, sortSegments(v));
    return map;
  }, [data.segments]);

  const airlines = useMemo(() => [...new Set(data.segments.map((s) => s.marketing_airline))].sort(), [data.segments]);
  const q = f.query.trim().toLowerCase();
  const inPeriod = (date: string) => !period || isDateInPeriod(date, period);
  const archivedOk = (row: { archived_at: string | null }) => (f.archived ? row.archived_at != null : row.archived_at == null);

  const segmentMatches = (s: FlightSegment, booking: Booking | undefined) =>
    (!f.airline || s.marketing_airline === f.airline) &&
    (!f.origin || s.origin_iata === f.origin.toUpperCase()) &&
    (!f.destination || s.destination_iata === f.destination.toUpperCase()) &&
    (!q ||
      s.origin_iata.toLowerCase().includes(q) ||
      s.destination_iata.toLowerCase().includes(q) ||
      (s.flight_number ?? '').toLowerCase().includes(q) ||
      (booking?.booking_name ?? '').toLowerCase().includes(q) ||
      (booking?.booking_reference ?? '').toLowerCase().includes(q));

  const bookings = data.bookings
        .filter((b) => {
          if (!archivedOk(b)) return false;
          if (f.category && b.category !== f.category) return false;
          if (f.status && b.status !== f.status) return false;
          const segs = (segmentsByBooking.get(b.id) ?? []).filter((s) => s.archived_at == null);
          if (period && !inPeriod(b.purchase_date) && !segs.some((s) => inPeriod(s.flight_date))) return false;
          const segmentFilters = f.airline || f.origin || f.destination;
          const nameHit = !q || b.booking_name.toLowerCase().includes(q) || (b.booking_reference ?? '').toLowerCase().includes(q);
          if (segmentFilters || (q && !nameHit)) return segs.some((s) => segmentMatches(s, b));
          return nameHit;
        })
    .sort((a, b) => firstDate(b).localeCompare(firstDate(a)));

  function firstDate(b: Booking): string {
    const segs = segmentsByBooking.get(b.id) ?? [];
    return segs[0]?.flight_date ?? b.purchase_date;
  }

  const flights = data.segments
    .filter((s) => {
      const booking = bookingsById.get(s.booking_id);
      if (!archivedOk(s) || (!f.archived && booking?.archived_at != null)) return false;
      if (!inPeriod(s.flight_date)) return false;
      if (f.status && s.segment_status !== f.status) return false;
      if (f.category && booking?.category !== f.category) return false;
      return segmentMatches(s, booking);
    })
    .sort((a, b) => (a.flight_date === b.flight_date ? b.position - a.position : b.flight_date.localeCompare(a.flight_date)));

  const xp = data.xpTransactions
    .filter(
      (t) =>
        archivedOk(t) &&
        inPeriod(t.transaction_date) &&
        (!f.source || t.source_type === f.source) &&
        (!f.status || t.status === f.status) &&
        (!q || `${t.source_type} ${t.description ?? ''} ${bookingsById.get(t.booking_id ?? '')?.booking_name ?? ''}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const credits = data.credits
    .filter(
      (c) =>
        archivedOk(c) &&
        inPeriod(c.transaction_date) &&
        (!q || `${c.credit_type} ${c.description ?? ''} ${bookingsById.get(c.booking_id ?? '')?.booking_name ?? ''}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const counts: Record<Tab, number> = { bookings: bookings.length, flights: flights.length, xp: xp.length, credits: credits.length };
  const statusOptions = tab === 'xp' ? XP_TRANSACTION_STATUSES : TRAVEL_STATUSES;

  return (
    <div className="flex flex-col gap-3">
      <input
        className="input"
        type="search"
        placeholder="Search airport, flight number, booking name or reference"
        value={f.query}
        onChange={(e) => set({ query: e.target.value })}
        aria-label="Search"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 text-sm">
        <FilterSelect label="Period" value={f.period} onChange={(v) => set({ period: v })}>
          <option value="">All time</option>
          {cycles.length > 0 ? (
            <optgroup label="Qualification cycles">
              {cycles.map((c) => (
                <option key={c.id} value={`cycle:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Calendar years">
            {years.map((y) => (
              <option key={y} value={`year:${y}`}>
                {y}
              </option>
            ))}
          </optgroup>
        </FilterSelect>
        {tab === 'bookings' || tab === 'flights' ? (
          <>
            <FilterSelect label="Category" value={f.category} onChange={(v) => set({ category: v })}>
              <option value="">All categories</option>
              {BOOKING_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="Airline" value={f.airline} onChange={(v) => set({ airline: v })}>
              <option value="">All airlines</option>
              {airlines.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </FilterSelect>
            <input
              className="input !min-h-10 !w-24 shrink-0 !py-1 font-mono uppercase"
              placeholder="From"
              aria-label="Origin"
              maxLength={3}
              value={f.origin}
              onChange={(e) => set({ origin: e.target.value.toUpperCase() })}
            />
            <input
              className="input !min-h-10 !w-24 shrink-0 !py-1 font-mono uppercase"
              placeholder="To"
              aria-label="Destination"
              maxLength={3}
              value={f.destination}
              onChange={(e) => set({ destination: e.target.value.toUpperCase() })}
            />
          </>
        ) : null}
        {tab === 'xp' ? (
          <FilterSelect label="Source" value={f.source} onChange={(v) => set({ source: v })}>
            <option value="">All sources</option>
            {XP_SOURCE_TYPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </FilterSelect>
        ) : null}
        {tab !== 'credits' ? (
          <FilterSelect label="Status" value={f.status} onChange={(v) => set({ status: v })}>
            <option value="">Any status</option>
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </FilterSelect>
        ) : null}
        <label className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-line px-3 text-sm">
          <input type="checkbox" checked={f.archived} onChange={(e) => set({ archived: e.target.checked })} className="accent-[var(--accent)]" />
          Show archived
        </label>
      </div>

      <div role="tablist" className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              set({ status: '' });
            }}
            className="min-h-9 flex-1 rounded-lg text-sm font-medium text-ink-2 aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-sm"
          >
            {t.label} <span className="text-xs text-muted tabular">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface">
        {tab === 'bookings' ? (
          bookings.length === 0 ? (
            <Empty archived={f.archived} />
          ) : (
            <ul className="divide-y divide-line">
              {bookings.map((b) => {
                const segs = (segmentsByBooking.get(b.id) ?? []).filter((s) => s.archived_at == null);
                const xpTotal = segs.reduce(
                  (acc, s) => {
                    const x = segmentXp(s, b);
                    return { actual: acc.actual + x.actual, booked: acc.booked + x.booked };
                  },
                  { actual: 0, booked: 0 },
                );
                return (
                  <Row key={b.id} href={`/booking?id=${b.id}`} archivedActions={f.archived ? <RecordActions table="bookings" id={b.id} archived compact /> : null}>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.booking_name}</p>
                      <p className="truncate font-mono text-xs text-ink-2">{routingLines(segs.filter((s) => s.segment_status !== 'Cancelled')).join(' · ') || 'No flights'}</p>
                      <p className="text-xs text-muted">
                        {formatDate(firstDate(b))} · {b.category}
                        {b.booking_reference ? ` · ${b.booking_reference}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular">{formatMoney(b.total_price, b.currency)}</span>
                      <XpBadge actual={xpTotal.actual} booked={xpTotal.booked} />
                      <StatusBadge status={b.status} />
                    </div>
                  </Row>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === 'flights' ? (
          flights.length === 0 ? (
            <Empty archived={f.archived} />
          ) : (
            <ul className="divide-y divide-line">
              {flights.map((s) => {
                const booking = bookingsById.get(s.booking_id);
                const x = segmentXp(s, booking);
                return (
                  <Row key={s.id} href={`/flight?id=${s.id}`} archivedActions={f.archived ? <RecordActions table="flight_segments" id={s.id} archived compact /> : null}>
                    <div className="min-w-0">
                      <p className="font-mono font-semibold">
                        {s.origin_iata} → {s.destination_iata}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {formatDate(s.flight_date)} · {s.marketing_airline}
                        {s.flight_number ? ` ${s.flight_number}` : ''} · {s.cabin} · {booking?.booking_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <XpBadge actual={x.actual} booked={x.booked} />
                      <StatusBadge status={booking?.status === 'Cancelled' ? 'Cancelled' : s.segment_status} />
                    </div>
                  </Row>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === 'xp' ? (
          xp.length === 0 ? (
            <Empty archived={f.archived} />
          ) : (
            <ul className="divide-y divide-line">
              {xp.map((t) => {
                const x = transactionXp(t);
                return (
                  <Row key={t.id} href={`/xp?id=${t.id}`} archivedActions={f.archived ? <RecordActions table="xp_transactions" id={t.id} archived compact /> : null}>
                    <div className="min-w-0">
                      <p className="font-medium">{t.source_type}</p>
                      <p className="truncate text-xs text-muted">
                        {formatDate(t.transaction_date)}
                        {t.description ? ` · ${t.description}` : ''}
                        {t.booking_id ? ` · ${bookingsById.get(t.booking_id)?.booking_name ?? ''}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <XpBadge actual={x.actual} booked={x.booked} />
                      <span className="text-xs text-ink-2 tabular">{formatMoney(t.cost, t.currency)}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  </Row>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === 'credits' ? (
          credits.length === 0 ? (
            <Empty archived={f.archived} />
          ) : (
            <ul className="divide-y divide-line">
              {credits.map((c) => (
                <Row key={c.id} href={`/credit?id=${c.id}`} archivedActions={f.archived ? <RecordActions table="credits" id={c.id} archived compact /> : null}>
                  <div className="min-w-0">
                    <p className="font-medium">{c.credit_type}</p>
                    <p className="truncate text-xs text-muted">
                      {formatDate(c.transaction_date)}
                      {c.description ? ` · ${c.description}` : ''}
                      {c.booking_id ? ` · ${bookingsById.get(c.booking_id)?.booking_name ?? ''}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium tabular text-good">−{formatMoney(c.amount, c.currency)}</span>
                    {!c.include_in_net_cost ? <span className="text-[11px] text-muted">not in net cost</span> : null}
                  </div>
                </Row>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}

function Row({ href, children, archivedActions }: { href: string; children: React.ReactNode; archivedActions: React.ReactNode }) {
  if (archivedActions) {
    return (
      <li className="flex items-center justify-between gap-3 px-3 py-3 opacity-80 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">{children}</div>
        {archivedActions}
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-surface-2 sm:px-4">
        {children}
      </Link>
    </li>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select className="input !min-h-10 !w-auto shrink-0 !py-1 text-sm" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

function Empty({ archived }: { archived: boolean }) {
  return (
    <div className="p-4">
      <EmptyState title={archived ? 'No archived records match' : 'Nothing matches these filters'} />
    </div>
  );
}
