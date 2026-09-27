'use client';
import { useState } from 'react';
import { BOOKING_CATEGORIES, type BookingCategory, TRAVEL_STATUSES, type TravelStatus } from '@/domain/types';
import type { BookingInput } from '@/lib/validation';
import { Field } from '@/components/ui/primitives';
import { CurrencyInput, Select } from './inputs';

export interface BookingDraft {
  booking_name: string;
  category: BookingCategory;
  purchase_date: string;
  total_price: string;
  currency: string;
  baseline_alternative_price: string;
  booking_reference: string;
  ticket_number: string;
  status: TravelStatus;
  notes: string;
}

export function bookingDraftToInput(b: BookingDraft): BookingInput {
  return {
    booking_name: b.booking_name,
    category: b.category,
    purchase_date: b.purchase_date,
    total_price: b.total_price === '' ? 0 : Number(b.total_price.replace(',', '.')),
    currency: b.currency,
    baseline_alternative_price: b.baseline_alternative_price === '' ? null : Number(b.baseline_alternative_price.replace(',', '.')),
    booking_reference: b.booking_reference || null,
    ticket_number: b.ticket_number || null,
    status: b.status,
    notes: b.notes || null,
  };
}

/** Booking-level fields. Only name, category, date, price and currency are shown by default. */
export function BookingFields({
  value,
  onChange,
  showErrors,
  showStatus = false,
  autoFocus = false,
}: {
  value: BookingDraft;
  onChange: (patch: Partial<BookingDraft>) => void;
  showErrors: boolean;
  showStatus?: boolean;
  autoFocus?: boolean;
}) {
  const [more, setMore] = useState(Boolean(value.booking_reference || value.ticket_number || value.baseline_alternative_price || value.notes));
  const nameError = showErrors && !value.booking_name.trim() ? 'Name required' : null;
  const dateError = showErrors && !/^\d{4}-\d{2}-\d{2}$/.test(value.purchase_date) ? 'Date required' : null;
  const priceError = showErrors && value.total_price !== '' && !/^\d+([.,]\d{1,2})?$/.test(value.total_price) ? 'Enter an amount' : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Booking name" error={nameError} className="col-span-2 sm:col-span-1">
          <input
            className="input"
            value={value.booking_name}
            placeholder="Nordic XP run"
            autoFocus={autoFocus}
            aria-invalid={Boolean(nameError) || undefined}
            onChange={(e) => onChange({ booking_name: e.target.value })}
          />
        </Field>
        <Field label="Category">
          <Select label="Category" value={value.category} options={BOOKING_CATEGORIES} onChange={(v) => onChange({ category: v })} />
        </Field>
        <Field label="Purchased" error={dateError}>
          <input type="date" className="input" value={value.purchase_date} onChange={(e) => onChange({ purchase_date: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-2 sm:grid-cols-[1fr_6rem_1fr]">
        <Field label="Total price" error={priceError}>
          <input
            className="input tabular"
            inputMode="decimal"
            value={value.total_price}
            placeholder="0.00"
            aria-invalid={Boolean(priceError) || undefined}
            onChange={(e) => onChange({ total_price: e.target.value.replace(/[^\d.,]/g, '') })}
          />
        </Field>
        <Field label="Currency">
          <CurrencyInput value={value.currency} onChange={(v) => onChange({ currency: v })} />
        </Field>
        {showStatus ? (
          <Field label="Status" className="col-span-2 sm:col-span-1">
            <Select label="Booking status" value={value.status} options={TRAVEL_STATUSES} onChange={(v) => onChange({ status: v })} />
          </Field>
        ) : null}
      </div>
      <button type="button" className="self-start text-xs text-ink-2 underline-offset-2 hover:underline" onClick={() => setMore(!more)} aria-expanded={more}>
        {more ? 'Hide details' : 'Reference, ticket number, baseline price, notes…'}
      </button>
      {more ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Booking reference">
            <input className="input uppercase" value={value.booking_reference} maxLength={20} placeholder="ABC123" onChange={(e) => onChange({ booking_reference: e.target.value })} />
          </Field>
          <Field label="Ticket number">
            <input className="input" value={value.ticket_number} maxLength={30} placeholder="074…" onChange={(e) => onChange({ ticket_number: e.target.value })} />
          </Field>
          <Field label="Baseline alternative price" hint="What you would have paid anyway" className="col-span-2 sm:col-span-1">
            <input
              className="input tabular"
              inputMode="decimal"
              value={value.baseline_alternative_price}
              placeholder="—"
              onChange={(e) => onChange({ baseline_alternative_price: e.target.value.replace(/[^\d.,]/g, '') })}
            />
          </Field>
          <Field label="Notes" className="col-span-2 sm:col-span-3">
            <textarea className="input min-h-20" value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
