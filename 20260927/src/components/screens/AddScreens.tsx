'use client';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useTracker } from '@/components/data/tracker-context';
import { AddFlightForm } from '@/components/forms/AddFlightForm';
import { CreditForm } from '@/components/forms/CreditForm';
import { type ItineraryPrefill, NewBookingForm } from '@/components/forms/NewBookingForm';
import { XpTransactionForm } from '@/components/forms/XpTransactionForm';
import { PageHeader } from '@/components/ui/primitives';
import { todayIso } from '@/domain/dates';
import { CABINS, XP_SOURCE_TYPES, type XpSourceType } from '@/domain/types';

const itinerarySchema = z.object({
  name: z.string().max(120).optional(),
  date: z.string().optional(),
  cabin: z.enum(CABINS).optional(),
  airline: z.string().max(40).optional(),
  legs: z
    .array(
      z.object({
        origin: z.string().regex(/^[A-Z]{3}$/),
        destination: z.string().regex(/^[A-Z]{3}$/),
        xp: z.number().int().nullable().optional(),
        cabin: z.enum(CABINS).optional(),
      }),
    )
    .max(40),
});

/** `?itinerary=` carries an itinerary from the XP calculator ("Save as booking"). */
function parsePrefill(raw: string | null): ItineraryPrefill | null {
  if (!raw) return null;
  try {
    const parsed = itinerarySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function AddBookingScreen() {
  const { settings, rules, entry } = useTracker();
  const prefill = parsePrefill(useSearchParams().get('itinerary'));
  return (
    <>
      <PageHeader title="Add booking" subtitle={prefill ? 'Itinerary from the XP calculator' : 'Booking details first, then its flights.'} />
      <NewBookingForm
        // Remount when a different itinerary arrives.
        key={prefill ? JSON.stringify(prefill) : 'blank'}
        defaults={{
          today: todayIso(),
          currency: settings.preferred_currency,
          category: settings.default_category,
          homeAirport: settings.home_airport,
          airline: settings.default_airline,
          cabin: entry.lastCabin ?? settings.default_cabin,
        }}
        rules={rules}
        recentAirports={entry.recentAirports}
        recentAirlines={entry.recentAirlines}
        prefill={prefill}
      />
    </>
  );
}

export function AddFlightScreen() {
  const { settings, rules, entry } = useTracker();
  const booking = useSearchParams().get('booking');
  const initial = booking && entry.bookings.some((b) => b.id === booking) ? booking : null;
  return (
    <>
      <PageHeader title="Add flight" subtitle="Chains from the booking's last flight." />
      <AddFlightForm
        key={initial ?? 'none'}
        bookings={entry.bookings}
        initialBookingId={initial}
        rules={rules}
        recentAirports={entry.recentAirports}
        recentAirlines={entry.recentAirlines}
        fallback={{
          homeAirport: settings.home_airport,
          airline: settings.default_airline,
          cabin: entry.lastCabin ?? settings.default_cabin,
          today: todayIso(),
        }}
      />
    </>
  );
}

export function AddXpScreen() {
  const { settings, entry } = useTracker();
  const params = useSearchParams();
  const source = params.get('source');
  return (
    <>
      <PageHeader title="Add XP" subtitle="SAF, credit card, promotion, Choice Benefit or other XP." />
      <XpTransactionForm
        bookings={entry.bookings}
        defaults={{
          today: todayIso(),
          currency: settings.preferred_currency,
          bookingId: params.get('booking'),
          source: XP_SOURCE_TYPES.includes(source as XpSourceType) ? (source as XpSourceType) : undefined,
        }}
      />
    </>
  );
}

export function AddCreditScreen() {
  const { settings, entry } = useTracker();
  return (
    <>
      <PageHeader title="Add credit" subtitle="Refunds, compensation, reimbursements and statement credits." />
      <CreditForm
        bookings={entry.bookings}
        defaults={{ today: todayIso(), currency: settings.preferred_currency, bookingId: useSearchParams().get('booking') }}
      />
    </>
  );
}
