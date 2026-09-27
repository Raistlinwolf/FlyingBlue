'use client';
// Detail/edit screens for a single record, addressed by ?id= (static hosting has no
// dynamic routes).
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BookingDetail } from '@/components/bookings/BookingDetail';
import { useTracker } from '@/components/data/tracker-context';
import { CreditForm } from '@/components/forms/CreditForm';
import { EditSegmentForm } from '@/components/forms/EditSegmentForm';
import { XpTransactionForm } from '@/components/forms/XpTransactionForm';
import { RecordActions } from '@/components/history/RecordActions';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui/primitives';
import { todayIso } from '@/domain/dates';

function NotFound() {
  return (
    <EmptyState title="Record not found">
      It may have been deleted.{' '}
      <LinkButton href="/history" size="sm" className="ml-1">
        Open history
      </LinkButton>
    </EmptyState>
  );
}

export function BookingScreen() {
  const { data } = useTracker();
  const id = useSearchParams().get('id');
  const booking = data.bookings.find((b) => b.id === id);
  if (!booking) return <NotFound />;
  return (
    <>
      <PageHeader title={booking.booking_name} />
      <BookingDetail
        key={booking.id}
        booking={booking}
        segments={data.segments.filter((s) => s.booking_id === booking.id)}
        xpTransactions={data.xpTransactions.filter((t) => t.booking_id === booking.id)}
        credits={data.credits.filter((c) => c.booking_id === booking.id)}
      />
    </>
  );
}

export function FlightScreen() {
  const { data, rules, entry } = useTracker();
  const id = useSearchParams().get('id');
  const segment = data.segments.find((s) => s.id === id);
  if (!segment) return <NotFound />;
  return (
    <>
      <PageHeader
        title={`${segment.origin_iata} → ${segment.destination_iata}`}
        subtitle={
          <Link href={`/booking?id=${segment.booking_id}`} className="underline-offset-2 hover:underline">
            ← Back to booking
          </Link>
        }
      />
      <EditSegmentForm key={segment.id} segment={segment} rules={rules} recentAirports={entry.recentAirports} recentAirlines={entry.recentAirlines} />
    </>
  );
}

export function XpScreen() {
  const { data, settings, entry } = useTracker();
  const id = useSearchParams().get('id');
  const txn = data.xpTransactions.find((t) => t.id === id);
  if (!txn) return <NotFound />;
  return (
    <>
      <PageHeader
        title={`${txn.source_type} XP`}
        subtitle={txn.description ?? undefined}
        actions={<RecordActions table="xp_transactions" id={txn.id} archived={txn.archived_at != null} duplicate />}
      />
      <XpTransactionForm key={txn.id} existing={txn} bookings={entry.bookings} defaults={{ today: todayIso(), currency: settings.preferred_currency }} />
    </>
  );
}

export function CreditScreen() {
  const { data, settings, entry } = useTracker();
  const id = useSearchParams().get('id');
  const credit = data.credits.find((c) => c.id === id);
  if (!credit) return <NotFound />;
  return (
    <>
      <PageHeader
        title={credit.credit_type}
        subtitle={credit.description ?? undefined}
        actions={<RecordActions table="credits" id={credit.id} archived={credit.archived_at != null} />}
      />
      <CreditForm key={credit.id} existing={credit} bookings={entry.bookings} defaults={{ today: todayIso(), currency: settings.preferred_currency }} />
    </>
  );
}
