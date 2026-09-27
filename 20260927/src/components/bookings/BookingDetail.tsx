'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { archiveRecord, restoreRecord } from '@/lib/store/records';
import {
  cancelBooking,
  duplicateBooking,
  duplicateSegment,
  markSegmentFlown,
  setSegmentStatus,
  updateBooking,
} from '@/lib/store/travel';
import { incrementalCost, routingLines, sortSegments } from '@/domain/bookings';
import { formatDate } from '@/domain/dates';
import type { Booking, Credit, FlightSegment, XpTransaction } from '@/domain/types';
import { toNumber } from '@/domain/types';
import { segmentXp, transactionXp } from '@/domain/xp';
import { formatMoney } from '@/lib/format';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Button, Card, CardTitle, EmptyState, LinkButton, Notice, StatusBadge, XpBadge } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';
import { type BookingDraft, BookingFields, bookingDraftToInput } from '@/components/forms/BookingFields';

export function BookingDetail({
  booking,
  segments,
  xpTransactions,
  credits,
}: {
  booking: Booking;
  segments: FlightSegment[];
  xpTransactions: XpTransaction[];
  credits: Credit[];
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const live = sortSegments(segments.filter((s) => s.archived_at == null));
  const archivedSegments = segments.filter((s) => s.archived_at != null);
  const visibleSegments = showArchived ? sortSegments(segments) : live;
  const archived = booking.archived_at != null;

  const flightXp = live.reduce(
    (acc, s) => {
      const xp = segmentXp(s, booking);
      return { actual: acc.actual + xp.actual, booked: acc.booked + xp.booked };
    },
    { actual: 0, booked: 0 },
  );
  const liveXp = xpTransactions.filter((t) => t.archived_at == null);
  const liveCredits = credits.filter((c) => c.archived_at == null);
  const routes = routingLines(live.filter((s) => s.segment_status !== 'Cancelled'));

  return (
    <div className="flex flex-col gap-4">
      {archived ? (
        <Notice>
          This booking is archived and excluded from all totals.{' '}
          <button className="font-medium underline" onClick={() => run(() => restoreRecord('bookings', booking.id), 'Booking restored')}>
            Restore
          </button>
        </Notice>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={booking.status} />
              <span className="text-xs text-muted">{booking.category}</span>
              {booking.booking_reference ? <span className="font-mono text-xs text-ink-2">{booking.booking_reference}</span> : null}
            </div>
            {routes.length > 0 ? (
              <p className="mt-2 font-mono text-sm text-ink-2">{routes.join(' · ')}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tabular">{formatMoney(booking.total_price, booking.currency)}</p>
            <p className="text-xs text-muted">
              Purchased {formatDate(booking.purchase_date)}
              {booking.baseline_alternative_price != null
                ? ` · incremental ${formatMoney(incrementalCost(booking), booking.currency)}`
                : ''}
            </p>
            <div className="mt-1">
              <XpBadge actual={flightXp.actual} booked={flightXp.booked} />
            </div>
          </div>
        </div>
        {booking.notes && !editing ? <p className="mt-3 whitespace-pre-wrap text-sm text-ink-2">{booking.notes}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
          <Button size="sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Close editor' : 'Edit booking'}
          </Button>
          <Button
            size="sm"
            pending={pending}
            onClick={async () => {
              const r = await run(() => duplicateBooking(booking.id), 'Booking duplicated');
              if (r.ok) router.push(`/booking?id=${r.data.id}`);
            }}
          >
            Duplicate
          </Button>
          {booking.status !== 'Cancelled' ? (
            <ConfirmButton
              title="Cancel this booking?"
              message="All its flights are marked cancelled and stop counting towards projected XP. The price still counts as spent — log the refund as a credit."
              confirmLabel="Cancel booking"
              onConfirm={() => run(() => cancelBooking(booking.id), 'Booking cancelled')}
            >
              Cancel booking
            </ConfirmButton>
          ) : null}
          {!archived ? (
            <ConfirmButton
              title="Archive this booking?"
              message="It disappears from dashboards and history, but you can restore it from History → Show archived."
              confirmLabel="Archive"
              onConfirm={async () => {
                const r = await run(() => archiveRecord('bookings', booking.id), 'Booking archived');
                if (r.ok) router.push('/history');
              }}
            >
              Archive
            </ConfirmButton>
          ) : null}
        </div>
        {editing ? <BookingEditor booking={booking} onDone={() => setEditing(false)} /> : null}
      </Card>

      <Card>
        <CardTitle
          action={
            <div className="flex items-center gap-2">
              {archivedSegments.length > 0 ? (
                <button className="text-xs text-ink-2 underline-offset-2 hover:underline" onClick={() => setShowArchived(!showArchived)}>
                  {showArchived ? 'Hide archived' : `Show archived (${archivedSegments.length})`}
                </button>
              ) : null}
              <LinkButton href={`/add/flight?booking=${booking.id}`} size="sm" variant="primary">
                + Flight
              </LinkButton>
            </div>
          }
        >
          Flights
        </CardTitle>
        {visibleSegments.length === 0 ? (
          <EmptyState title="No flights on this booking yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {visibleSegments.map((s) => (
              <SegmentItem key={s.id} segment={s} booking={booking} />
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle action={<LinkButton href={`/add/xp?booking=${booking.id}`} size="sm">+ XP</LinkButton>}>Linked XP (SAF, promotions…)</CardTitle>
          {liveXp.length === 0 ? (
            <p className="text-sm text-muted">None linked.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {liveXp.map((t) => {
                const xp = transactionXp(t);
                return (
                  <li key={t.id}>
                    <Link href={`/xp?id=${t.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-accent-ink">
                      <span>
                        {t.source_type}
                        <span className="block text-xs text-muted">
                          {formatDate(t.transaction_date)}
                          {toNumber(t.cost) > 0 ? ` · ${formatMoney(t.cost, t.currency)}` : ''}
                        </span>
                      </span>
                      <XpBadge actual={xp.actual} booked={xp.booked} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle action={<LinkButton href={`/add/credit?booking=${booking.id}`} size="sm">+ Credit</LinkButton>}>Refunds & credits</CardTitle>
          {liveCredits.length === 0 ? (
            <p className="text-sm text-muted">None recorded.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {liveCredits.map((c) => (
                <li key={c.id}>
                  <Link href={`/credit?id=${c.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-accent-ink">
                    <span>
                      {c.credit_type}
                      <span className="block text-xs text-muted">
                        {formatDate(c.transaction_date)}
                        {c.include_in_net_cost ? '' : ' · not in net cost'}
                      </span>
                    </span>
                    <span className="font-medium tabular text-good">−{formatMoney(c.amount, c.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SegmentItem({ segment: s, booking }: { segment: FlightSegment; booking: Booking }) {
  const { pending, run } = useAction();
  const xp = segmentXp(s, booking);
  const archived = s.archived_at != null;
  const cancelled = s.segment_status === 'Cancelled' || booking.status === 'Cancelled';
  return (
    <li className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${archived ? 'opacity-60' : ''}`}>
      <Link href={`/flight?id=${s.id}`} className="min-w-0 hover:text-accent-ink">
        <span className={`font-mono text-base font-semibold ${cancelled ? 'line-through' : ''}`}>
          {s.origin_iata} → {s.destination_iata}
        </span>
        <span className="block text-xs text-muted">
          {formatDate(s.flight_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {s.marketing_airline}
          {s.flight_number ? ` ${s.flight_number}` : ''} · {s.cabin}
          {s.fare_class ? ` (${s.fare_class})` : ''}
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={archived ? 'Archived' : s.segment_status} />
        <XpBadge actual={xp.actual} booked={xp.booked} />
        {!archived && !cancelled && s.segment_status !== 'Flown' ? (
          <Button size="sm" variant="ghost" pending={pending} onClick={() => run(() => markSegmentFlown(s.id), 'Marked as flown')}>
            ✓ Flown
          </Button>
        ) : null}
        {!archived ? (
          <Button size="sm" variant="ghost" onClick={() => run(() => duplicateSegment(s.id), 'Flight duplicated')}>
            Duplicate
          </Button>
        ) : null}
        {!archived && s.segment_status !== 'Cancelled' ? (
          <ConfirmButton
            variant="ghost"
            title="Cancel this flight?"
            message="It stays on the booking but no longer counts towards projected XP."
            confirmLabel="Cancel flight"
            onConfirm={() => run(() => setSegmentStatus(s.id, 'Cancelled'), 'Flight cancelled')}
          >
            Cancel
          </ConfirmButton>
        ) : null}
        {archived ? (
          <Button size="sm" variant="ghost" onClick={() => run(() => restoreRecord('flight_segments', s.id), 'Flight restored')}>
            Restore
          </Button>
        ) : (
          <ConfirmButton
            variant="ghost"
            title="Archive this flight?"
            message="It is removed from all totals. You can restore it later."
            confirmLabel="Archive"
            onConfirm={() => run(() => archiveRecord('flight_segments', s.id), 'Flight archived')}
          >
            Archive
          </ConfirmButton>
        )}
      </div>
    </li>
  );
}

function BookingEditor({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const { pending, run } = useAction();
  const [showErrors, setShowErrors] = useState(false);
  const [draft, setDraft] = useState<BookingDraft>({
    booking_name: booking.booking_name,
    category: booking.category,
    purchase_date: booking.purchase_date,
    total_price: String(booking.total_price),
    currency: booking.currency,
    baseline_alternative_price: booking.baseline_alternative_price == null ? '' : String(booking.baseline_alternative_price),
    booking_reference: booking.booking_reference ?? '',
    ticket_number: booking.ticket_number ?? '',
    status: booking.status,
    notes: booking.notes ?? '',
  });
  return (
    <div className="mt-4 border-t border-line pt-4">
      <BookingFields value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} showErrors={showErrors} showStatus />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Discard
        </Button>
        <Button
          variant="primary"
          pending={pending}
          onClick={async () => {
            setShowErrors(true);
            if (!draft.booking_name.trim()) return;
            const r = await run(() => updateBooking(booking.id, bookingDraftToInput(draft)), 'Booking updated');
            if (r.ok) onDone();
          }}
        >
          Save booking
        </Button>
      </div>
    </div>
  );
}
