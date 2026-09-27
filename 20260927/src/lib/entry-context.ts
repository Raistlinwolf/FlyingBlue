// Values used to prefill entry forms: recent airports and airlines, the last cabin
// and the bookings a new flight or XP entry can be attached to.
import { sortSegments } from '@/domain/bookings';
import type { Cabin, TrackerData } from '@/domain/types';

export interface RecentBookingOption {
  id: string;
  booking_name: string;
  status: string;
  lastDate: string | null;
  lastDestination: string | null;
  lastAirline: string | null;
  lastCabin: Cabin | null;
}

export interface EntryContext {
  recentAirports: string[];
  recentAirlines: string[];
  lastCabin: Cabin | null;
  bookings: RecentBookingOption[];
}

const byCreatedDesc = (a: { created_at?: string }, b: { created_at?: string }) =>
  (b.created_at ?? '').localeCompare(a.created_at ?? '');

export function entryContext(data: TrackerData): EntryContext {
  const liveBookings = data.bookings.filter((b) => b.archived_at == null);
  const liveIds = new Set(liveBookings.map((b) => b.id));
  const segments = data.segments.filter((s) => s.archived_at == null && liveIds.has(s.booking_id)).sort(byCreatedDesc);

  const recentAirports: string[] = [];
  const recentAirlines: string[] = [];
  for (const s of segments) {
    for (const code of [s.origin_iata, s.destination_iata]) if (!recentAirports.includes(code)) recentAirports.push(code);
    if (!recentAirlines.includes(s.marketing_airline)) recentAirlines.push(s.marketing_airline);
  }

  const bookings = [...liveBookings]
    .sort((a, b) => {
      // Upcoming/most recent travel first, then newest entries.
      const last = (id: string) => sortSegments(segments.filter((s) => s.booking_id === id)).at(-1)?.flight_date ?? '';
      return last(b.id).localeCompare(last(a.id)) || byCreatedDesc(a, b);
    })
    .map((b) => {
      const last = sortSegments(segments.filter((s) => s.booking_id === b.id)).at(-1);
      return {
        id: b.id,
        booking_name: b.booking_name,
        status: b.status,
        lastDate: last?.flight_date ?? null,
        lastDestination: last?.destination_iata ?? null,
        lastAirline: last?.marketing_airline ?? null,
        lastCabin: last?.cabin ?? null,
      };
    });

  return {
    recentAirports: recentAirports.slice(0, 12),
    recentAirlines: recentAirlines.slice(0, 8),
    lastCabin: segments[0]?.cabin ?? null,
    bookings,
  };
}
