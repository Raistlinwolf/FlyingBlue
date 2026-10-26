// Expected vs actual XP. Every XP-bearing item lands in exactly one bucket, which is
// what guarantees actual and expected XP are never added together for the same item.
import type { Booking, FlightSegment, TravelStatus, XpTransaction } from './types';

export interface XpBucket {
  /** XP credited to the account (actual_xp recorded). */
  actual: number;
  /** XP not yet credited: planned, booked, or flown but not yet posted. */
  booked: number;
}

export const EMPTY_BUCKET: XpBucket = { actual: 0, booked: 0 };

/** A segment under a cancelled booking is cancelled, whatever its own status says. */
export function effectiveSegmentStatus(segment: FlightSegment, booking?: Pick<Booking, 'status'> | null): TravelStatus {
  if (booking?.status === 'Cancelled') return 'Cancelled';
  return segment.segment_status;
}

export function segmentXp(segment: FlightSegment, booking?: Pick<Booking, 'status'> | null): XpBucket {
  if (effectiveSegmentStatus(segment, booking) === 'Cancelled') return EMPTY_BUCKET;
  if (segment.actual_xp != null) return { actual: segment.actual_xp, booked: 0 };
  return { actual: 0, booked: segment.expected_xp };
}

export function transactionXp(txn: XpTransaction): XpBucket {
  if (txn.status === 'Cancelled') return EMPTY_BUCKET;
  if (txn.actual_xp != null) return { actual: txn.actual_xp, booked: 0 };
  return { actual: 0, booked: txn.expected_xp };
}

export function projected(bucket: XpBucket): number {
  return bucket.actual + bucket.booked;
}

export function addBuckets(a: XpBucket, b: XpBucket): XpBucket {
  return { actual: a.actual + b.actual, booked: a.booked + b.booked };
}
