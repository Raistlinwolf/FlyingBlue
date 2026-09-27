'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveCredit } from '@/lib/store/records';
import { CREDIT_TYPES, type Credit, type CreditType } from '@/domain/types';
import { Button, Card, Field } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';
import { CurrencyInput, Select, Toggle } from './inputs';
import type { BookingChoice } from './XpTransactionForm';

/** Vouchers are not cash, so by default they do not reduce net cost. */
const NOT_CASH: CreditType[] = ['Voucher'];

export function CreditForm({
  existing,
  bookings,
  defaults,
}: {
  existing?: Credit | null;
  bookings: BookingChoice[];
  defaults: { today: string; currency: string; bookingId?: string | null };
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [showErrors, setShowErrors] = useState(false);
  const [includeTouched, setIncludeTouched] = useState(Boolean(existing));
  const [form, setForm] = useState({
    transaction_date: existing?.transaction_date ?? defaults.today,
    credit_type: existing?.credit_type ?? ('Ticket Refund' as CreditType),
    description: existing?.description ?? '',
    amount: existing ? String(existing.amount) : '',
    currency: existing?.currency ?? defaults.currency,
    include_in_net_cost: existing?.include_in_net_cost ?? true,
    booking_id: existing?.booking_id ?? defaults.bookingId ?? '',
    notes: existing?.notes ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const amountError = showErrors && !/^\d+([.,]\d{1,2})?$/.test(form.amount) ? 'Enter an amount' : null;

  async function save() {
    setShowErrors(true);
    if (!/^\d+([.,]\d{1,2})?$/.test(form.amount) || !form.transaction_date) return;
    const result = await run(
      () =>
        saveCredit(existing?.id ?? null, {
          transaction_date: form.transaction_date,
          credit_type: form.credit_type,
          description: form.description || null,
          amount: Number(form.amount.replace(',', '.')),
          currency: form.currency,
          include_in_net_cost: form.include_in_net_cost,
          booking_id: form.booking_id || null,
          notes: form.notes || null,
        }),
      existing ? 'Credit updated' : 'Credit saved',
    );
    if (result.ok) router.push(form.booking_id ? `/booking?id=${form.booking_id}` : '/history?tab=credits');
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Type" className="col-span-2">
          <Select
            label="Credit type"
            value={form.credit_type}
            options={CREDIT_TYPES}
            onChange={(v) => set({ credit_type: v, ...(includeTouched ? {} : { include_in_net_cost: !NOT_CASH.includes(v) }) })}
          />
        </Field>
        <Field label="Date" className="col-span-2 sm:col-span-2">
          <input type="date" className="input" value={form.transaction_date} onChange={(e) => set({ transaction_date: e.target.value })} />
        </Field>
        <Field label="Amount" error={amountError}>
          <input
            className="input tabular"
            inputMode="decimal"
            autoFocus={!existing}
            value={form.amount}
            placeholder="0.00"
            aria-invalid={Boolean(amountError) || undefined}
            onChange={(e) => set({ amount: e.target.value.replace(/[^\d.,]/g, '') })}
          />
        </Field>
        <Field label="Currency">
          <CurrencyInput value={form.currency} onChange={(v) => set({ currency: v })} />
        </Field>
        <Field label="Linked booking (optional)" className="col-span-2">
          <Select
            label="Linked booking"
            value={form.booking_id}
            options={[{ value: '', label: '— none —' }, ...bookings.map((b) => ({ value: b.id, label: b.booking_name }))]}
            onChange={(v) => set({ booking_id: v })}
          />
        </Field>
      </div>
      <Toggle
        label="Reduces net travel cost"
        hint="Turn off for vouchers or money that is not really yours to keep"
        checked={form.include_in_net_cost}
        onChange={(v) => {
          setIncludeTouched(true);
          set({ include_in_net_cost: v });
        }}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Description">
          <input className="input" value={form.description} placeholder="EC261 delay KL1125" onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Notes">
          <input className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" pending={pending} onClick={save}>
          {existing ? 'Save changes' : 'Save credit'}
        </Button>
      </div>
    </Card>
  );
}
