'use client';
import { useState } from 'react';
import { deleteCycle, saveCycle } from '@/lib/store/settings';
import { addDays, formatDate } from '@/domain/dates';
import { validateCycle } from '@/domain/periods';
import { FB_STATUSES, type FlyingBlueStatus, type QualificationCycle } from '@/domain/types';
import { Select } from '@/components/forms/inputs';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Button, Field } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

interface CycleDraft {
  name: string;
  start_date: string;
  end_date: string;
  starting_status: FlyingBlueStatus;
  target_xp: string;
  carried_over_xp: string;
  notes: string;
}

/**
 * Qualification cycles are plain date ranges. Records are assigned by date at query
 * time, so adding or editing a cycle never rewrites historical data.
 */
export function CyclesManager({
  cycles,
  defaults,
}: {
  cycles: QualificationCycle[];
  defaults: { status: FlyingBlueStatus; target: number; today: string };
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(cycles.length === 0 ? 'new' : null);

  // A new cycle starts the day after the latest one ends and lasts twelve months.
  const latest = cycles[0];
  const start = latest ? addDays(latest.end_date, 1) : `${defaults.today.slice(0, 7)}-01`;
  const nextYear = `${Number(start.slice(0, 4)) + 1}${start.slice(4)}`;
  const newDraft: CycleDraft = {
    name: `FB ${start.slice(0, 4)}`,
    start_date: start,
    end_date: addDays(nextYear, -1),
    starting_status: defaults.status,
    target_xp: String(defaults.target),
    carried_over_xp: '0',
    notes: '',
  };

  return (
    <div className="flex flex-col gap-3">
      {cycles.length === 0 ? (
        <p className="text-sm text-ink-2">
          Add your Flying Blue qualification period. It rarely matches the calendar year — check the dates in your Flying Blue account.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {cycles.map((c) =>
            editing === c.id ? (
              <li key={c.id} className="p-3">
                <CycleEditor
                  id={c.id}
                  initial={{ ...c, target_xp: String(c.target_xp), carried_over_xp: String(c.carried_over_xp ?? 0), notes: c.notes ?? '' }}
                  cycles={cycles}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(c.start_date)} – {formatDate(c.end_date)} · from {c.starting_status} · target {c.target_xp} XP{c.carried_over_xp ? ` · ${c.carried_over_xp} carried over` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c.id)}>
                    Edit
                  </Button>
                  <DeleteCycle cycle={c} />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {editing === 'new' ? (
        <div className="rounded-xl border border-line p-3">
          <CycleEditor id={null} initial={newDraft} cycles={cycles} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <Button className="self-start" onClick={() => setEditing('new')}>
          + Add cycle
        </Button>
      )}
    </div>
  );
}

function DeleteCycle({ cycle }: { cycle: QualificationCycle }) {
  const { run } = useAction();
  return (
    <ConfirmButton
      variant="ghost"
      title={`Delete “${cycle.name}”?`}
      message="Only the cycle definition is removed. Flights, XP and credits stay untouched and still appear in calendar-year views."
      confirmLabel="Delete cycle"
      onConfirm={() => run(() => deleteCycle(cycle.id), 'Cycle deleted')}
    >
      Delete
    </ConfirmButton>
  );
}

function CycleEditor({
  id,
  initial,
  cycles,
  onDone,
}: {
  id: string | null;
  initial: CycleDraft;
  cycles: QualificationCycle[];
  onDone: () => void;
}) {
  const { pending, run } = useAction();
  const [d, setD] = useState<CycleDraft>(initial);
  const set = (patch: Partial<CycleDraft>) => setD((x) => ({ ...x, ...patch }));
  const clash = d.start_date && d.end_date ? validateCycle({ ...d, id: id ?? undefined }, cycles) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Field label="Name" className="col-span-2 sm:col-span-1">
          <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Start">
          <input type="date" className="input" value={d.start_date} onChange={(e) => set({ start_date: e.target.value })} />
        </Field>
        <Field label="End">
          <input type="date" className="input" value={d.end_date} onChange={(e) => set({ end_date: e.target.value })} />
        </Field>
        <Field label="Starting status">
          <Select label="Starting status" value={d.starting_status} options={FB_STATUSES} onChange={(v) => set({ starting_status: v })} />
        </Field>
        <Field label="Target XP">
          <input className="input tabular" inputMode="numeric" value={d.target_xp} onChange={(e) => set({ target_xp: e.target.value.replace(/[^\d]/g, '') })} />
        </Field>
        <Field label="Carried over XP" hint="Surplus from the previous cycle">
          <input
            className="input tabular"
            inputMode="numeric"
            value={d.carried_over_xp}
            onChange={(e) => set({ carried_over_xp: e.target.value.replace(/[^\d]/g, '') })}
          />
        </Field>
      </div>
      <Field label="Notes">
        <input className="input" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      {clash ? <p className="text-sm text-danger">{clash}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          pending={pending}
          disabled={Boolean(clash)}
          onClick={async () => {
            const r = await run(
              () => saveCycle(id, { ...d, target_xp: Number(d.target_xp || 0), carried_over_xp: Number(d.carried_over_xp || 0), notes: d.notes || null }),
              id ? 'Cycle updated' : 'Cycle added',
            );
            if (r.ok) onDone();
          }}
        >
          Save cycle
        </Button>
      </div>
    </div>
  );
}
