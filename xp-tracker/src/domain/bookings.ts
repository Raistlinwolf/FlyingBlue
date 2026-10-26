import type { Booking, FlightSegment, IsoDate } from './types';
import { toNumber } from './types';
import { effectiveSegmentStatus } from './xp';

/** incremental_cost = max(total_price − baseline_alternative_price, 0), in the booking currency. */
export function incrementalCost(booking: Pick<Booking, 'total_price' | 'baseline_alternative_price'>): number {
  return Math.max(toNumber(booking.total_price) - toNumber(booking.baseline_alternative_price), 0);
}

/** Planned bookings are not paid yet, so they do not count as spending. */
export function isPaid(status: string): boolean {
  return status !== 'Planned';
}

export function sortSegments<T extends Pick<FlightSegment, 'flight_date' | 'position'>>(segments: T[]): T[] {
  return [...segments].sort((a, b) =>
    a.flight_date === b.flight_date ? a.position - b.position : a.flight_date < b.flight_date ? -1 : 1,
  );
}

/**
 * The date a booking's cost is attributed to: its first non-cancelled segment, so the
 * cost lands in the same period as the XP it buys. Falls back to the purchase date.
 */
export function bookingAttributionDate(booking: Booking, segments: FlightSegment[]): IsoDate {
  const live = sortSegments(
    segments.filter((s) => s.archived_at == null && effectiveSegmentStatus(s, booking) !== 'Cancelled'),
  );
  if (live.length > 0) return live[0].flight_date;
  const any = sortSegments(segments.filter((s) => s.archived_at == null));
  return any.length > 0 ? any[0].flight_date : booking.purchase_date;
}

/**
 * Compact routing for a list of segments: contiguous legs are chained
 * (AMS → CPH → ARN), breaks start a new line.
 */
export function routingLines(segments: Pick<FlightSegment, 'origin_iata' | 'destination_iata'>[]): string[] {
  const lines: string[][] = [];
  for (const s of segments) {
    const current = lines[lines.length - 1];
    if (current && current[current.length - 1] === s.origin_iata) current.push(s.destination_iata);
    else lines.push([s.origin_iata, s.destination_iata]);
  }
  return lines.map((l) => l.join(' → '));
}
