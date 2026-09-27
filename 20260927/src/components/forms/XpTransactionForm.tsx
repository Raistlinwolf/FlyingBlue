'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveXpTransaction } from '@/lib/store/records';
import { XP_SOURCE_TYPES, XP_TRANSACTION_STATUSES, type XpSourceType, type XpTransaction, type XpTransactionStatus } from '@/domain/types';
import { Button, Card, Field } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';
import { CurrencyInput, Segmented, Select } from './inputs';

export interface BookingChoice {
  id: string;
  booking_name: string;
}

/** Add/edit a non-flight XP transaction (SAF, credit card, promotion, …). */
export function XpTransactionForm({
  existing,
  bookings,
  defaults,
}: {
  existing?: XpTransaction | null;
  bookings: BookingChoice[];
  defaults: { today: string; currency: string; bookingId?: string | null; source?: XpSourceType };
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState({
    transaction_date: existing?.transaction_date ?? defaults.today,
    source_type: existing?.source_type ?? defaults.source ?? ('SAF' as XpSourceType),
    description: existing?.description ?? '',
    cost: existing ? String(existing.cost) : '',
    currency: existing?.currency ?? defaults.currency,
    expected_xp: existing ? String(existing.expected_xp) : '',
    actual_xp: existing?.actual_xp == null ? '' : String(existing.actual_xp),
    status: existing?.status ?? ('Credited' as XpTransactionStatus),
    booking_id: existing?.booking_id ?? defaults.bookingId ?? '',
    notes: existing?.notes ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const xpError = showErrors && !/^-?\d+$/.test(form.expected_xp) ? 'Enter XP' : null;

  async function save() {
    setShowErrors(true);
    if (!/^-?\d+$/.test(form.expected_xp) || !form.transaction_date) return;
    // Credited without an explicit actual value: the expected XP was credited.
    const actual = form.actual_xp !== '' ? Number(form.actual_xp) : form.status === 'Credited' ? Number(form.expected_xp) : null;
    const result = await run(
      () =>
        saveXpTransaction(existing?.id ?? null, {
          transaction_date: form.transaction_date,
          source_type: form.source_type,
          description: form.description || null,
          cost: form.cost === '' ? 0 : Number(form.cost.replace(',', '.')),
          currency: form.currency,
          expected_xp: Number(form.expected_xp),
          actual_xp: actual,
          status: form.status,
          booking_id: form.booking_id || null,
          notes: form.notes || null,
        }),
      existing ? 'XP transaction updated' : 'XP saved',
    );
    if (result.ok) router.push(existing ? '/history?tab=xp' : '/dashboard');
  }

  return (
    <Card className="flex flex-col gap-3">
      <Field label="Source">
        <Segmented label="Source" value={form.source_type} options={XP_SOURCE_TYPES} onChange={(v) => set({ source_type: v })} />
      </Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Date">
          <input type="date" className="input" value={form.transaction_date} onChange={(e) => set({ transaction_date: e.target.value })} />
        </Field>
        <Field label="XP" error={xpError} hint={form.source_type === 'Adjustment' ? 'Negative allowed' : undefined}>
          <input
            className="input tabular"
            inputMode="numeric"
            autoFocus={!existing}
            value={form.expected_xp}
            placeholder="12"
            aria-invalid={Boolean(xpError) || undefined}
            onChange={(e) => set({ expected_xp: e.target.value.replace(/[^\d-]/g, '') })}
          />
        </Field>
        <Field label="Cost">
          <input
            className="input tabular"
            inputMode="decimal"
            value={form.cost}
            placeholder="0.00"
            onChange={(e) => set({ cost: e.target.value.replace(/[^\d.,]/g, '') })}
          />
        </Field>
        <Field label="Currency">
          <CurrencyInput value={form.currency} onChange={(v) => set({ currency: v })} />
        </Field>
      </div>
      <Field label="Status" hint={form.status === 'Credited' ? 'Counts as earned XP' : 'Counts as booked XP until credited'}>
        <Segmented label="Status" value={form.status} options={XP_TRANSACTION_STATUSES} onChange={(v) => set({ status: v })} />
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Description">
          <input className="input" value={form.description} placeholder="SAF purchase KL" onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Linked booking (optional)">
          <Select
            label="Linked booking"
            value={form.booking_id}
            options={[{ value: '', label: '— none —' }, ...bookings.map((b) => ({ value: b.id, label: b.booking_name }))]}
            onChange={(v) => set({ booking_id: v })}
          />
        </Field>
        <Field label="Actual XP" hint="Leave empty to use XP when credited">
          <input
            className="input tabular"
            inputMode="numeric"
            value={form.actual_xp}
            placeholder="—"
            onChange={(e) => set({ actual_xp: e.target.value.replace(/[^\d-]/g, '') })}
          />
        </Field>
        <Field label="Notes">
          <input className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" pending={pending} onClick={save}>
          {existing ? 'Save changes' : 'Save XP'}
        </Button>
      </div>
    </Card>
  );
}
