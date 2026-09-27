'use client';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { estimateSegmentXp } from '@/domain/calculator';
import { CABINS, TRAVEL_STATUSES, type XpRule } from '@/domain/types';
import { getAirports } from '@/lib/airports-client';
import { TrashIcon } from '@/components/ui/icons';
import { Button, Field } from '@/components/ui/primitives';
import { AirlineInput, Segmented } from './inputs';
import { AirportInput } from './AirportInput';
import { type SegmentDraft, chainedDraft, draftErrors, emptyDraft, returnDrafts } from './segment-draft';

const CABIN_SHORT = { Economy: 'Eco', 'Premium Economy': 'Prem', Business: 'Biz', First: 'First' } as const;

/**
 * Editable list of flight segments. Adding a segment chains from the previous one
 * (its destination becomes the next origin) and XP is estimated from the rules
 * until the user overrides it.
 */
export function SegmentEditor({
  drafts,
  onChange,
  rules,
  recentAirports,
  recentAirlines,
  showErrors,
  showActual = false,
  allowMultiple = true,
  defaults,
}: {
  drafts: SegmentDraft[];
  onChange: Dispatch<SetStateAction<SegmentDraft[]>>;
  rules: XpRule[];
  recentAirports: string[];
  recentAirlines: string[];
  showErrors: boolean;
  showActual?: boolean;
  allowMultiple?: boolean;
  defaults?: Partial<SegmentDraft>;
}) {
  function update(key: string, patch: Partial<SegmentDraft>) {
    onChange((current) => current.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  // Estimate XP whenever route, cabin or date change; applied to the latest state.
  const signature = drafts.map((d) => `${d.key}:${d.origin_iata}-${d.destination_iata}:${d.cabin}:${d.flight_date}`).join('|');
  useEffect(() => {
    const codes = drafts.flatMap((d) => [d.origin_iata, d.destination_iata]);
    if (!codes.some((c) => /^[A-Z]{3}$/.test(c))) return;
    let cancelled = false;
    getAirports(codes).then((airports) => {
      if (cancelled) return;
      onChange((current) => {
        let changed = false;
        const next = current.map((d) => {
          const valid = /^[A-Z]{3}$/.test(d.origin_iata) && /^[A-Z]{3}$/.test(d.destination_iata) && d.origin_iata !== d.destination_iata;
          if (!valid) {
            if (!d.estimate) return d;
            changed = true;
            return { ...d, estimate: null };
          }
          const estimate = estimateSegmentXp(
            { origin: d.origin_iata, destination: d.destination_iata, cabin: d.cabin, date: d.flight_date || new Date().toISOString().slice(0, 10) },
            airports,
            rules,
          );
          const expected = !d.xpTouched && estimate.xp != null ? String(estimate.xp) : d.expected_xp;
          if (expected === d.expected_xp && estimate.xp === d.estimate?.xp && estimate.distanceMiles === d.estimate?.distanceMiles) return d;
          changed = true;
          return { ...d, estimate, expected_xp: expected };
        });
        return changed ? next : current;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, rules]);

  const totalXp = drafts.reduce((sum, d) => sum + (Number(d.expected_xp) || 0), 0);

  return (
    <div className="flex flex-col gap-3">
      {drafts.map((d, index) => (
        <SegmentRow
          key={d.key}
          index={index}
          draft={d}
          canRemove={drafts.length > 1}
          showErrors={showErrors}
          showActual={showActual}
          recentAirports={recentAirports}
          recentAirlines={recentAirlines}
          onPatch={(patch) => update(d.key, patch)}
          onRemove={() => onChange((current) => current.filter((x) => x.key !== d.key))}
        />
      ))}

      {allowMultiple ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const last = drafts[drafts.length - 1];
              onChange([...drafts, last ? chainedDraft(last) : emptyDraft(defaults)]);
            }}
          >
            + Add another segment
          </Button>
          {drafts.length > 0 && drafts.every((d) => d.origin_iata && d.destination_iata) ? (
            <Button variant="ghost" onClick={() => onChange([...drafts, ...returnDrafts(drafts)])}>
              ⇄ Add return legs
            </Button>
          ) : null}
          <span className="ml-auto text-sm text-ink-2 tabular">
            {drafts.length} segment{drafts.length === 1 ? '' : 's'} · <strong className="text-ink">{totalXp} XP</strong> expected
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SegmentRow({
  index,
  draft: d,
  canRemove,
  showErrors,
  showActual,
  recentAirports,
  recentAirlines,
  onPatch,
  onRemove,
}: {
  index: number;
  draft: SegmentDraft;
  canRemove: boolean;
  showErrors: boolean;
  showActual: boolean;
  recentAirports: string[];
  recentAirlines: string[];
  onPatch: (patch: Partial<SegmentDraft>) => void;
  onRemove: () => void;
}) {
  const [more, setMore] = useState(Boolean(d.flight_number || d.operating_airline || d.fare_class || d.notes));
  const errors = showErrors ? draftErrors(d) : {};
  const est = d.estimate;

  return (
    <fieldset className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <legend className="sr-only">Segment {index + 1}</legend>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Segment {index + 1}</span>
        {canRemove ? (
          <button type="button" onClick={onRemove} aria-label={`Remove segment ${index + 1}`} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-danger">
            <TrashIcon width={18} height={18} />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[9rem_1fr_1fr_6rem]">
        <Field label="Date" error={errors.flight_date} className="col-span-2 sm:col-span-1">
          <input
            type="date"
            className="input"
            value={d.flight_date}
            aria-invalid={Boolean(errors.flight_date) || undefined}
            onChange={(e) => onPatch({ flight_date: e.target.value })}
          />
        </Field>
        <Field label="From" error={errors.origin_iata}>
          <AirportInput
            label="Origin airport"
            value={d.origin_iata}
            recent={recentAirports}
            invalid={Boolean(errors.origin_iata)}
            onChange={(v) => onPatch({ origin_iata: v })}
          />
        </Field>
        <Field label="To" error={errors.destination_iata}>
          <AirportInput
            label="Destination airport"
            value={d.destination_iata}
            recent={recentAirports}
            placeholder="CPH"
            invalid={Boolean(errors.destination_iata)}
            autoFocus={index > 0 && !d.destination_iata}
            onChange={(v) => onPatch({ destination_iata: v })}
          />
        </Field>
        <Field label="Airline" error={errors.marketing_airline} className="col-span-2 sm:col-span-1">
          <AirlineInput value={d.marketing_airline} recent={recentAirlines} invalid={Boolean(errors.marketing_airline)} onChange={(v) => onPatch({ marketing_airline: v })} />
        </Field>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_6.5rem] gap-2 sm:grid-cols-[1fr_7rem_auto]">
        <Field label="Cabin">
          <Segmented label="Cabin" value={d.cabin} options={CABINS} short={CABIN_SHORT} onChange={(v) => onPatch({ cabin: v })} />
        </Field>
        <Field
          label="Expected XP"
          error={errors.expected_xp}
          hint={
            est?.xp != null
              ? `${est.routeCategory} · ${est.distanceMiles?.toLocaleString('en-GB')} mi`
              : est?.problem === 'no-rule'
                ? 'No XP rule for route'
                : est?.problem
                  ? 'Airport not in database'
                  : undefined
          }
        >
          <input
            className="input tabular"
            inputMode="numeric"
            value={d.expected_xp}
            placeholder="0"
            aria-invalid={Boolean(errors.expected_xp) || undefined}
            onChange={(e) => onPatch({ expected_xp: e.target.value.replace(/[^\d]/g, ''), xpTouched: true })}
          />
        </Field>
        {d.xpTouched && est?.xp != null && String(est.xp) !== d.expected_xp ? (
          <div className="col-span-2 flex items-end sm:col-span-1">
            <button
              type="button"
              className="mb-1 text-xs text-accent-ink underline-offset-2 hover:underline"
              onClick={() => onPatch({ expected_xp: String(est.xp), xpTouched: false })}
            >
              Use estimate ({est.xp})
            </button>
          </div>
        ) : null}
      </div>

      {showActual ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem]">
          <Field label="Status">
            <Segmented label="Segment status" value={d.segment_status} options={TRAVEL_STATUSES} onChange={(v) => onPatch({ segment_status: v })} />
          </Field>
          <Field label="Actual XP" hint="Credited XP (overrides expected)">
            <input
              className="input tabular"
              inputMode="numeric"
              value={d.actual_xp}
              placeholder="—"
              onChange={(e) => onPatch({ actual_xp: e.target.value.replace(/[^\d]/g, '') })}
            />
          </Field>
        </div>
      ) : null}

      <button type="button" className="mt-2 text-xs text-ink-2 underline-offset-2 hover:underline" onClick={() => setMore(!more)} aria-expanded={more}>
        {more ? 'Hide details' : 'Flight number, fare class, notes…'}
      </button>
      {more ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Flight number">
            <input className="input uppercase" value={d.flight_number} placeholder="KL1125" maxLength={10} onChange={(e) => onPatch({ flight_number: e.target.value })} />
          </Field>
          <Field label="Operated by">
            <input className="input uppercase" value={d.operating_airline} placeholder="WA" maxLength={40} onChange={(e) => onPatch({ operating_airline: e.target.value })} />
          </Field>
          <Field label="Fare class">
            <input className="input uppercase" value={d.fare_class} placeholder="T" maxLength={2} onChange={(e) => onPatch({ fare_class: e.target.value })} />
          </Field>
          {!showActual ? (
            <Field label="Status">
              <select className="input" value={d.segment_status} onChange={(e) => onPatch({ segment_status: e.target.value as SegmentDraft['segment_status'] })}>
                {TRAVEL_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Notes" className="col-span-2 sm:col-span-4">
            <input className="input" value={d.notes} onChange={(e) => onPatch({ notes: e.target.value })} />
          </Field>
        </div>
      ) : null}
    </fieldset>
  );
}
