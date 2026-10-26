'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addSegments } from '@/lib/store/travel';
import type { Cabin, XpRule } from '@/domain/types';
import type { RecentBookingOption } from '@/lib/entry-context';
import { Button, Card, EmptyState, Field, LinkButton, buttonClass } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';
import { SegmentEditor } from './SegmentEditor';
import { type SegmentDraft, draftErrors, draftToInput, emptyDraft } from './segment-draft';

/** Add Flight: one or more segments on an existing booking, chained from its last flight. */
export function AddFlightForm({
  bookings,
  initialBookingId,
  rules,
  recentAirports,
  recentAirlines,
  fallback,
}: {
  bookings: RecentBookingOption[];
  initialBookingId: string | null;
  rules: XpRule[];
  recentAirports: string[];
  recentAirlines: string[];
  fallback: { homeAirport: string | null; airline: string | null; cabin: Cabin; today: string };
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [bookingId, setBookingId] = useState(initialBookingId ?? bookings[0]?.id ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const defaultsFor = (id: string): Partial<SegmentDraft> => {
    const b = bookings.find((x) => x.id === id);
    return {
      flight_date: b?.lastDate ?? fallback.today,
      origin_iata: b?.lastDestination ?? fallback.homeAirport ?? '',
      marketing_airline: b?.lastAirline ?? fallback.airline ?? '',
      cabin: (b?.lastCabin as Cabin | null) ?? fallback.cabin,
    };
  };
  const [segments, setSegments] = useState<SegmentDraft[]>(() => [emptyDraft(defaultsFor(bookingId))]);

  if (bookings.length === 0) {
    return (
      <EmptyState title="No bookings yet">
        Flights belong to a booking.{' '}
        <Link href="/add/booking" className={buttonClass('primary', 'sm', 'ml-1')}>
          Add a booking
        </Link>
      </EmptyState>
    );
  }

  async function save() {
    setShowErrors(true);
    if (!bookingId || segments.some((s) => Object.keys(draftErrors(s)).length > 0)) return;
    const result = await run(() => addSegments(bookingId, segments.map(draftToInput)), 'Flight added');
    if (result.ok) router.push(`/booking?id=${bookingId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Field label="Booking">
          <select
            className="input"
            value={bookingId}
            onChange={(e) => {
              setBookingId(e.target.value);
              // Re-chain the untouched first segment from the newly chosen booking.
              if (segments.length === 1 && !segments[0].destination_iata) setSegments([emptyDraft(defaultsFor(e.target.value))]);
            }}
          >
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.booking_name}
                {b.lastDate ? ` — last flight ${b.lastDate}` : ''}
                {b.status === 'Cancelled' ? ' (cancelled)' : ''}
              </option>
            ))}
          </select>
        </Field>
      </Card>
      <SegmentEditor
        drafts={segments}
        onChange={setSegments}
        rules={rules}
        recentAirports={recentAirports}
        recentAirlines={recentAirlines}
        showErrors={showErrors}
        defaults={defaultsFor(bookingId)}
      />
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex justify-end gap-2 md:bottom-4">
        <LinkButton href="/dashboard" size="lg" className="shadow-lg">
          Cancel
        </LinkButton>
        <Button variant="primary" size="lg" pending={pending} onClick={save} className="shadow-lg">
          Save {segments.length === 1 ? 'flight' : `${segments.length} flights`}
        </Button>
      </div>
    </div>
  );
}
