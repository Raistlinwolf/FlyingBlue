'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBookingWithSegments } from '@/lib/store/travel';
import type { BookingCategory, Cabin, XpRule } from '@/domain/types';
import { Button, Card, CardTitle } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';
import { type BookingDraft, BookingFields, bookingDraftToInput } from './BookingFields';
import { SegmentEditor } from './SegmentEditor';
import { type SegmentDraft, draftErrors, draftToInput, emptyDraft } from './segment-draft';

export interface NewBookingDefaults {
  today: string;
  currency: string;
  category: BookingCategory;
  homeAirport: string | null;
  airline: string | null;
  cabin: Cabin;
}

export interface ItineraryPrefill {
  name?: string;
  date?: string;
  cabin?: Cabin;
  airline?: string;
  legs: { origin: string; destination: string; xp?: number | null; cabin?: Cabin }[];
}

/** Add Booking: booking details and its segments on one screen, saved together. */
export function NewBookingForm({
  defaults,
  rules,
  recentAirports,
  recentAirlines,
  prefill,
}: {
  defaults: NewBookingDefaults;
  rules: XpRule[];
  recentAirports: string[];
  recentAirlines: string[];
  prefill?: ItineraryPrefill | null;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [showErrors, setShowErrors] = useState(false);
  const [booking, setBooking] = useState<BookingDraft>({
    booking_name: prefill?.name ?? '',
    category: defaults.category,
    purchase_date: defaults.today,
    total_price: '',
    currency: defaults.currency,
    baseline_alternative_price: '',
    booking_reference: '',
    ticket_number: '',
    status: 'Booked',
    notes: '',
  });
  const segmentDefaults: Partial<SegmentDraft> = {
    flight_date: prefill?.date ?? '',
    origin_iata: defaults.homeAirport ?? '',
    marketing_airline: prefill?.airline ?? defaults.airline ?? '',
    cabin: prefill?.cabin ?? defaults.cabin,
  };
  const [segments, setSegments] = useState<SegmentDraft[]>(() =>
    prefill?.legs.length
      ? prefill.legs.map((leg) =>
          emptyDraft({
            ...segmentDefaults,
            origin_iata: leg.origin,
            destination_iata: leg.destination,
            cabin: leg.cabin ?? segmentDefaults.cabin,
            expected_xp: leg.xp != null ? String(leg.xp) : '',
            xpTouched: leg.xp != null,
          }),
        )
      : [emptyDraft(segmentDefaults)],
  );

  // Segments left completely blank are ignored, so a booking can be saved first.
  const filled = segments.filter((s) => s.origin_iata || s.destination_iata || s.flight_date);

  async function save() {
    setShowErrors(true);
    const bookingInvalid = !booking.booking_name.trim() || !booking.purchase_date;
    const segmentsInvalid = filled.some((s) => Object.keys(draftErrors(s)).length > 0);
    if (bookingInvalid || segmentsInvalid) return;
    const result = await run(
      () => createBookingWithSegments({ booking: bookingDraftToInput(booking), segments: filled.map(draftToInput) }),
      'Booking saved',
    );
    if (result.ok) router.push(`/booking?id=${result.data.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>1 · Booking</CardTitle>
        <BookingFields value={booking} onChange={(p) => setBooking((b) => ({ ...b, ...p }))} showErrors={showErrors} autoFocus={!prefill} />
      </Card>

      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold">2 · Flights</h2>
        <SegmentEditor
          drafts={segments}
          onChange={setSegments}
          rules={rules}
          recentAirports={recentAirports}
          recentAirlines={recentAirlines}
          showErrors={showErrors}
          defaults={segmentDefaults}
        />
      </section>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex justify-end gap-2 md:bottom-4">
        <Button variant="primary" size="lg" pending={pending} onClick={save} className="shadow-lg">
          Save booking{filled.length > 0 ? ` · ${filled.length} flight${filled.length === 1 ? '' : 's'}` : ''}
        </Button>
      </div>
    </div>
  );
}
