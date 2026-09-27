// Monthly travel calendar: a Monday-first grid plus per-day travel details.
import { routingLines, sortSegments } from './bookings';
import { addDays, firstDayOfMonth, lastDayOfMonth, weekdayMondayFirst } from './dates';
import type { Booking, FlightSegment, IsoDate, TrackerData, XpTransaction } from './types';
import { effectiveSegmentStatus, segmentXp, transactionXp } from './xp';

export interface CalendarSegment {
  segment: FlightSegment;
  booking: Booking;
  cancelled: boolean;
}

export interface CalendarDay {
  date: IsoDate;
  segments: CalendarSegment[];
  xpTransactions: XpTransaction[];
  routes: string[];
  bookingNames: string[];
  flights: number;
  actualXp: number;
  bookedXp: number;
}

/** Weeks of the month; days outside the month are null. */
export function monthGrid(month: string): (IsoDate | null)[][] {
  const first = firstDayOfMonth(month);
  const last = lastDayOfMonth(month);
  const cells: (IsoDate | null)[] = Array(weekdayMondayFirst(first)).fill(null);
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function calendarDays(data: TrackerData, month: string): Map<IsoDate, CalendarDay> {
  const start = firstDayOfMonth(month);
  const end = lastDayOfMonth(month);
  const bookings = new Map(data.bookings.filter((b) => b.archived_at == null).map((b) => [b.id, b]));
  const days = new Map<IsoDate, CalendarDay>();
  const day = (date: IsoDate) => {
    let d = days.get(date);
    if (!d) {
      d = { date, segments: [], xpTransactions: [], routes: [], bookingNames: [], flights: 0, actualXp: 0, bookedXp: 0 };
      days.set(date, d);
    }
    return d;
  };

  for (const s of sortSegments(data.segments)) {
    if (s.archived_at != null || s.flight_date < start || s.flight_date > end) continue;
    const booking = bookings.get(s.booking_id);
    if (!booking) continue;
    const d = day(s.flight_date);
    const cancelled = effectiveSegmentStatus(s, booking) === 'Cancelled';
    d.segments.push({ segment: s, booking, cancelled });
    if (cancelled) continue;
    const xp = segmentXp(s, booking);
    d.flights += 1;
    d.actualXp += xp.actual;
    d.bookedXp += xp.booked;
    if (!d.bookingNames.includes(booking.booking_name)) d.bookingNames.push(booking.booking_name);
  }

  for (const t of data.xpTransactions) {
    if (t.archived_at != null || t.transaction_date < start || t.transaction_date > end) continue;
    const d = day(t.transaction_date);
    d.xpTransactions.push(t);
    const xp = transactionXp(t);
    d.actualXp += xp.actual;
    d.bookedXp += xp.booked;
  }

  for (const d of days.values()) {
    d.routes = routingLines(d.segments.filter((s) => !s.cancelled).map((s) => s.segment));
  }
  return days;
}
