'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { CalendarDay } from '@/domain/calendar';
import { formatDate } from '@/domain/dates';
import { segmentXp, transactionXp } from '@/domain/xp';
import { ChevronLeft, ChevronRight, CloseIcon } from '@/components/ui/icons';
import { LinkButton, StatusBadge, XpBadge, buttonClass } from '@/components/ui/primitives';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView({
  month,
  prevMonth,
  nextMonth,
  thisMonth,
  today,
  weeks,
  days,
}: {
  month: string;
  prevMonth: string;
  nextMonth: string;
  thisMonth: string;
  today: string;
  weeks: (string | null)[][];
  days: Record<string, CalendarDay>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected ? days[selected] : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2">
          <Link href={`/calendar?month=${prevMonth}`} className={buttonClass('secondary', 'sm')} aria-label="Previous month">
            <ChevronLeft />
          </Link>
          <Link href={`/calendar?month=${nextMonth}`} className={buttonClass('secondary', 'sm')} aria-label="Next month">
            <ChevronRight />
          </Link>
          {month !== thisMonth ? (
            <Link href="/calendar" className={buttonClass('ghost', 'sm')}>
              Today
            </Link>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-medium uppercase tracking-wide text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-line last:border-b-0">
              {week.map((date, di) => {
                if (!date) return <div key={di} className="min-h-16 bg-surface-2/50 sm:min-h-28" />;
                const info = days[date];
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelected(info ? date : null)}
                    aria-label={`${formatDate(date)}${info ? `, ${info.flights} flights, ${info.actualXp + info.bookedXp} XP` : ''}`}
                    aria-pressed={selected === date}
                    className="flex min-h-16 flex-col items-stretch gap-1 border-r border-line p-1 text-left last:border-r-0 hover:bg-surface-2 aria-pressed:bg-accent-soft sm:min-h-28 sm:p-1.5"
                  >
                    <span
                      className={`self-start rounded-md px-1 text-xs tabular ${isToday ? 'bg-accent font-semibold text-white' : 'text-ink-2'}`}
                    >
                      {Number(date.slice(8))}
                    </span>
                    {info ? <DayCell info={info} /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {day ? (
        <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:static lg:z-auto lg:w-80 lg:rounded-2xl lg:shadow-none">
          <DayDetails day={day} onClose={() => setSelected(null)} />
        </aside>
      ) : (
        <aside className="hidden text-sm text-muted lg:block lg:w-80">Tap a day with travel to see its flights.</aside>
      )}
    </div>
  );
}

function DayCell({ info }: { info: CalendarDay }) {
  const xp = info.actualXp + info.bookedXp;
  const solid = info.bookedXp === 0;
  return (
    <>
      {/* Mobile: compact badges */}
      <span className="flex flex-col gap-0.5 sm:hidden">
        {info.flights > 0 ? (
          <span className="rounded bg-accent-soft px-1 text-[10px] font-semibold text-accent-ink">✈{info.flights}</span>
        ) : null}
        {xp !== 0 ? (
          <span
            className={`rounded px-1 text-[10px] font-semibold tabular ${solid ? 'bg-xp-actual text-white' : 'border border-dashed border-xp-actual text-accent-ink'}`}
          >
            {xp}
          </span>
        ) : null}
      </span>
      {/* Desktop: routing, XP and trip name */}
      <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
        {info.routes.map((r) => (
          <span key={r} className="truncate font-mono text-[11px] leading-tight text-ink" title={r}>
            {r.replaceAll(' → ', '→')}
          </span>
        ))}
        {info.xpTransactions.length > 0 ? (
          <span className="truncate text-[10px] text-ink-2">{info.xpTransactions.map((t) => t.source_type).join(', ')}</span>
        ) : null}
        {xp !== 0 ? (
          <span className="mt-auto flex items-center justify-between gap-1">
            <span className="truncate text-[10px] text-muted">{info.bookingNames[0] ?? ''}</span>
            <span
              className={`shrink-0 rounded px-1 text-[10px] font-semibold tabular ${solid ? 'bg-xp-actual text-white' : 'border border-dashed border-xp-actual text-accent-ink'}`}
            >
              {xp} XP
            </span>
          </span>
        ) : null}
      </span>
    </>
  );
}

function DayDetails({ day, onClose }: { day: CalendarDay; onClose: () => void }) {
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
          <div className="mt-1">
            <XpBadge actual={day.actualXp} booked={day.bookedXp} />
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      {day.routes.length > 0 ? (
        <div className="mb-3 rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm">
          {day.routes.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
      ) : null}
      <ul className="flex flex-col divide-y divide-line text-sm">
        {day.segments.map(({ segment: s, booking, cancelled }) => {
          const xp = segmentXp(s, booking);
          return (
            <li key={s.id}>
              <Link href={`/flight?id=${s.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-accent-ink">
                <span className="min-w-0">
                  <span className={`font-mono font-semibold ${cancelled ? 'line-through' : ''}`}>
                    {s.origin_iata} → {s.destination_iata}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {s.marketing_airline}
                    {s.flight_number ? ` ${s.flight_number}` : ''} · {s.cabin} · {booking.booking_name}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <XpBadge actual={xp.actual} booked={xp.booked} />
                  {cancelled ? <StatusBadge status="Cancelled" /> : null}
                </span>
              </Link>
            </li>
          );
        })}
        {day.xpTransactions.map((t) => {
          const xp = transactionXp(t);
          return (
            <li key={t.id}>
              <Link href={`/xp?id=${t.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-accent-ink">
                <span>
                  {t.source_type}
                  {t.description ? <span className="block text-xs text-muted">{t.description}</span> : null}
                </span>
                <XpBadge actual={xp.actual} booked={xp.booked} />
              </Link>
            </li>
          );
        })}
      </ul>
      {day.segments[0] ? (
        <LinkButton href={`/booking?id=${day.segments[0].booking.id}`} size="sm" className="mt-3 w-full">
          Open booking
        </LinkButton>
      ) : null}
    </div>
  );
}
