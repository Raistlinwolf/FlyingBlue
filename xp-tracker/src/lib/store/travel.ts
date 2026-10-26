// Bookings and flight segments.
import type { Booking, FlightSegment, TravelStatus } from '@/domain/types';
import { TRAVEL_STATUSES } from '@/domain/types';
import { type ActionResult, describeDbError, fail, noRowChanged, ok } from '@/lib/action-result';
import { getSupabase } from '@/lib/supabase/client';
import {
  type BookingInput,
  type SegmentInput,
  bookingSchema,
  bookingWithSegmentsSchema,
  firstIssue,
  segmentSchema,
} from '@/lib/validation';


type SegmentRow = Omit<ReturnType<typeof segmentSchema.parse>, 'id'>;

export async function createBookingWithSegments(input: {
  booking: BookingInput;
  segments: SegmentInput[];
}): Promise<ActionResult<{ id: string }>> {
  const parsed = bookingWithSegmentsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();

  const { data: booking, error } = await supabase.from('bookings').insert(parsed.data.booking).select('id').single();
  if (error) return fail(describeDbError(error));

  if (parsed.data.segments.length > 0) {
    const rows = parsed.data.segments.map(({ id: _id, ...s }, position) => ({ ...s, booking_id: booking.id, position }));
    const { error: segError } = await supabase.from('flight_segments').insert(rows);
    if (segError) {
      // Keep the save all-or-nothing.
      await supabase.from('bookings').delete().eq('id', booking.id);
      return fail(describeDbError(segError));
    }
  }
  return ok({ id: booking.id });
}

export async function updateBooking(id: string, input: BookingInput): Promise<ActionResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const { data: before, error: loadError } = await supabase.from('bookings').select('status').eq('id', id).maybeSingle();
  if (loadError) return fail(describeDbError(loadError));
  if (!before) return fail(noRowChanged(null)!);

  const { data, error } = await supabase.from('bookings').update(parsed.data).eq('id', id).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);

  // Flight XP follows the flights, so booking status changes are passed on to them.
  if (parsed.data.status === 'Cancelled') {
    const { error: segError } = await supabase.from('flight_segments').update({ segment_status: 'Cancelled' }).eq('booking_id', id);
    if (segError) return fail(describeDbError(segError));
  } else if (before.status === 'Flown' && (parsed.data.status === 'Booked' || parsed.data.status === 'Planned')) {
    // "Not flown after all": un-fly its flown flights and clear their credited XP.
    const { error: segError } = await supabase
      .from('flight_segments')
      .update({ segment_status: parsed.data.status, actual_xp: null })
      .eq('booking_id', id)
      .eq('segment_status', 'Flown');
    if (segError) return fail(describeDbError(segError));
  }
  return ok(null);
}

export async function cancelBooking(id: string): Promise<ActionResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('bookings').update({ status: 'Cancelled' }).eq('id', id).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  const { error: segError } = await supabase
    .from('flight_segments')
    .update({ segment_status: 'Cancelled' })
    .eq('booking_id', id);
  if (segError) return fail(describeDbError(segError));
  return ok(null);
}

/** Copies a booking and its live segments as a new planned itinerary (no actual XP). */
export async function duplicateBooking(id: string): Promise<ActionResult<{ id: string }>> {
  const supabase = getSupabase();
  const { data: source, error } = await supabase.from('bookings').select('*').eq('id', id).single<Booking>();
  if (error) return fail(describeDbError(error));
  const { data: segments, error: segError } = await supabase
    .from('flight_segments')
    .select('*')
    .eq('booking_id', id)
    .is('archived_at', null)
    .order('position');
  if (segError) return fail(describeDbError(segError));

  const { data: copy, error: insertError } = await supabase
    .from('bookings')
    .insert({
      booking_name: `${source.booking_name} (copy)`.slice(0, 120),
      category: source.category,
      purchase_date: source.purchase_date,
      total_price: source.total_price,
      currency: source.currency,
      baseline_alternative_price: source.baseline_alternative_price,
      notes: source.notes,
      status: 'Planned',
    })
    .select('id')
    .single();
  if (insertError) return fail(describeDbError(insertError));

  const rows = ((segments ?? []) as FlightSegment[]).map((s, position) => ({
    ...segmentCopy(s),
    booking_id: copy.id,
    position,
  }));
  if (rows.length > 0) {
    const { error: copyError } = await supabase.from('flight_segments').insert(rows);
    if (copyError) return fail(describeDbError(copyError));
  }
  return ok({ id: copy.id });
}

function segmentCopy(s: FlightSegment) {
  return {
    flight_date: s.flight_date,
    flight_number: s.flight_number,
    origin_iata: s.origin_iata,
    destination_iata: s.destination_iata,
    marketing_airline: s.marketing_airline,
    operating_airline: s.operating_airline,
    cabin: s.cabin,
    fare_class: s.fare_class,
    expected_xp: s.expected_xp,
    actual_xp: null,
    segment_status: 'Planned' as const,
    notes: s.notes,
  };
}

async function nextPosition(bookingId: string): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('flight_segments')
    .select('position')
    .eq('booking_id', bookingId)
    .order('position', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0].position + 1 : 0;
}

export async function addSegments(bookingId: string, input: SegmentInput[]): Promise<ActionResult> {
  const parsed = segmentSchema.array().min(1, 'Add at least one flight.').max(40).safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const start = await nextPosition(bookingId);
  const rows: (SegmentRow & { booking_id: string; position: number })[] = parsed.data.map(({ id: _id, ...s }, i) => ({
    ...s,
    booking_id: bookingId,
    position: start + i,
  }));
  const { error } = await supabase.from('flight_segments').insert(rows);
  if (error) return fail(describeDbError(error));
  return ok(null);
}

export async function updateSegment(id: string, input: SegmentInput): Promise<ActionResult> {
  const parsed = segmentSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const { id: _id, ...row } = parsed.data;
  const { data, error } = await supabase.from('flight_segments').update(row).eq('id', id).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  return ok(null);
}

export async function duplicateSegment(id: string): Promise<ActionResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('flight_segments').select('*').eq('id', id).single<FlightSegment>();
  if (error) return fail(describeDbError(error));
  const position = await nextPosition(data.booking_id);
  // The copy is a new, unflown flight.
  const segment_status = data.segment_status === 'Planned' ? 'Planned' : 'Booked';
  const { error: insertError } = await supabase
    .from('flight_segments')
    .insert({ ...segmentCopy(data), segment_status, booking_id: data.booking_id, position });
  if (insertError) return fail(describeDbError(insertError));
  return ok(null);
}

/** Marks a segment flown; actual XP defaults to the expected XP unless already recorded. */
export async function markSegmentFlown(id: string, actualXp?: number): Promise<ActionResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('flight_segments').select('*').eq('id', id).single<FlightSegment>();
  if (error) return fail(describeDbError(error));
  const actual = actualXp ?? data.actual_xp ?? data.expected_xp;
  const { error: updateError } = await supabase
    .from('flight_segments')
    .update({ segment_status: 'Flown', actual_xp: actual })
    .eq('id', id);
  if (updateError) return fail(describeDbError(updateError));

  // When every live segment is flown, the booking is flown too.
  const { data: siblings } = await supabase
    .from('flight_segments')
    .select('segment_status')
    .eq('booking_id', data.booking_id)
    .is('archived_at', null);
  const live = (siblings ?? []).filter((s) => s.segment_status !== 'Cancelled');
  if (live.length > 0 && live.every((s) => s.segment_status === 'Flown')) {
    await supabase.from('bookings').update({ status: 'Flown' }).eq('id', data.booking_id).neq('status', 'Cancelled');
  }
  return ok(null);
}

export async function setSegmentStatus(id: string, status: TravelStatus): Promise<ActionResult> {
  if (!TRAVEL_STATUSES.includes(status)) return fail('Unknown status.');
  const supabase = getSupabase();
  const { data, error } = await supabase.from('flight_segments').update({ segment_status: status }).eq('id', id).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  return ok(null);
}

/** Undo "Flown": back to Booked with the credited XP cleared; the booking follows. */
export async function unmarkSegmentFlown(id: string): Promise<ActionResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('flight_segments')
    .update({ segment_status: 'Booked', actual_xp: null })
    .eq('id', id)
    .select('booking_id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: 'Booked' })
    .eq('id', data![0].booking_id)
    .eq('status', 'Flown');
  if (bookingError) return fail(describeDbError(bookingError));
  return ok(null);
}
