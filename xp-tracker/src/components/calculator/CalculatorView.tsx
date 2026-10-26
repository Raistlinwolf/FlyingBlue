'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type XpEstimate, estimateSegmentXp } from '@/domain/calculator';
import { CABINS, type Cabin, type XpRule } from '@/domain/types';
import { getAirports } from '@/lib/airports-client';
import { formatXp } from '@/lib/format';
import { AirportInput } from '@/components/forms/AirportInput';
import { AirlineInput, Segmented } from '@/components/forms/inputs';
import { TrashIcon } from '@/components/ui/icons';
import { Button, Card, CardTitle, Field, Notice } from '@/components/ui/primitives';

const CABIN_SHORT = { Economy: 'Eco', 'Premium Economy': 'Prem', Business: 'Biz', First: 'First' } as const;

interface Leg {
  key: number;
  origin: string;
  destination: string;
  cabin: Cabin;
  override: string;
}

let nextKey = 1;

export function CalculatorView({
  rules,
  today,
  homeAirport,
  defaultCabin,
  defaultAirline,
  recentAirports,
  recentAirlines,
}: {
  rules: XpRule[];
  today: string;
  homeAirport: string | null;
  defaultCabin: Cabin;
  defaultAirline: string | null;
  recentAirports: string[];
  recentAirlines: string[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [airline, setAirline] = useState(defaultAirline ?? '');
  const [legs, setLegs] = useState<Leg[]>([{ key: nextKey++, origin: homeAirport ?? '', destination: '', cabin: defaultCabin, override: '' }]);
  const [estimates, setEstimates] = useState<Record<number, XpEstimate | null>>({});

  const signature = legs.map((l) => `${l.key}:${l.origin}-${l.destination}:${l.cabin}`).join('|') + date;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const valid = legs.filter((l) => /^[A-Z]{3}$/.test(l.origin) && /^[A-Z]{3}$/.test(l.destination) && l.origin !== l.destination);
      const airports = await getAirports(valid.flatMap((l) => [l.origin, l.destination]));
      if (cancelled) return;
      const next: Record<number, XpEstimate | null> = {};
      for (const l of legs) {
        next[l.key] = valid.includes(l) ? estimateSegmentXp({ origin: l.origin, destination: l.destination, cabin: l.cabin, date }, airports, rules) : null;
      }
      setEstimates(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, rules]);

  const update = (key: number, patch: Partial<Leg>) => setLegs((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const xpFor = (l: Leg) => (l.override !== '' ? Number(l.override) : (estimates[l.key]?.xp ?? null));
  const total = legs.reduce((sum, l) => sum + (xpFor(l) ?? 0), 0);
  const miles = legs.reduce((sum, l) => sum + (estimates[l.key]?.distanceMiles ?? 0), 0);
  const complete = legs.filter((l) => /^[A-Z]{3}$/.test(l.origin) && /^[A-Z]{3}$/.test(l.destination) && l.origin !== l.destination);

  function saveAsBooking() {
    const itinerary = {
      name: complete.length ? `${complete[0].origin}–${complete[complete.length - 1].destination}` : undefined,
      date,
      airline: airline || undefined,
      legs: complete.map((l) => ({ origin: l.origin, destination: l.destination, cabin: l.cabin, xp: xpFor(l) })),
    };
    router.push(`/add/booking?itinerary=${encodeURIComponent(JSON.stringify(itinerary))}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-3">
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Travel date" hint="Selects the XP rules in force">
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Airline (optional)">
              <AirlineInput value={airline} recent={recentAirlines} onChange={setAirline} />
            </Field>
          </div>
        </Card>

        {legs.map((l, i) => {
          const est = estimates[l.key];
          return (
            <Card key={l.key} className="!p-3 sm:!p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Segment {i + 1}</span>
                {legs.length > 1 ? (
                  <button type="button" aria-label={`Remove segment ${i + 1}`} className="rounded-lg p-1.5 text-muted hover:text-danger" onClick={() => setLegs((ls) => ls.filter((x) => x.key !== l.key))}>
                    <TrashIcon width={18} height={18} />
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="From">
                  <AirportInput label="Origin airport" value={l.origin} recent={recentAirports} onChange={(v) => update(l.key, { origin: v })} />
                </Field>
                <Field label="To">
                  <AirportInput label="Destination airport" value={l.destination} placeholder="CPH" recent={recentAirports} autoFocus={i > 0 && !l.destination} onChange={(v) => update(l.key, { destination: v })} />
                </Field>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_6.5rem] gap-2">
                <Field label="Cabin">
                  <Segmented label="Cabin" value={l.cabin} options={CABINS} short={CABIN_SHORT} onChange={(v) => update(l.key, { cabin: v })} />
                </Field>
                <Field label="Override XP">
                  <input
                    className="input tabular"
                    inputMode="numeric"
                    placeholder={est?.xp != null ? String(est.xp) : '—'}
                    value={l.override}
                    onChange={(e) => update(l.key, { override: e.target.value.replace(/[^\d]/g, '') })}
                  />
                </Field>
              </div>
              {est ? (
                <p className="mt-2 text-xs text-ink-2">
                  {est.problem === 'unknown-origin' || est.problem === 'unknown-destination'
                    ? 'Airport not found in the database — enter XP manually.'
                    : `${est.distanceMiles?.toLocaleString('en-GB')} mi · ${est.domestic ? 'domestic · ' : ''}${est.routeCategory ?? 'no matching rule'} · ${est.xp ?? '—'} XP`}
                </p>
              ) : null}
            </Card>
          );
        })}

        <Button
          onClick={() => {
            const last = legs[legs.length - 1];
            setLegs([...legs, { key: nextKey++, origin: last?.destination ?? '', destination: '', cabin: last?.cabin ?? defaultCabin, override: '' }]);
          }}
        >
          + Add segment
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardTitle>Estimate</CardTitle>
          <table className="w-full text-sm">
            <tbody className="tabular">
              {legs.map((l) => {
                const est = estimates[l.key];
                const xp = xpFor(l);
                return (
                  <tr key={l.key} className="border-b border-line last:border-0">
                    <td className="py-1.5 font-mono">
                      {l.origin || '___'} → {l.destination || '___'}
                    </td>
                    <td className="py-1.5 text-xs text-muted">{est?.routeCategory ?? ''}</td>
                    <td className="py-1.5 text-right font-medium">
                      {xp ?? '—'}
                      {l.override !== '' ? <span className="ml-1 text-[10px] text-muted">manual</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-sm text-ink-2">{miles > 0 ? `${miles.toLocaleString('en-GB')} mi flown` : ''}</span>
            <span className="text-3xl font-semibold">{formatXp(total)} XP</span>
          </div>
          <Button variant="primary" size="lg" className="mt-4 w-full" disabled={complete.length === 0} onClick={saveAsBooking}>
            Save as booking
          </Button>
        </Card>
        {rules.length === 0 ? (
          <Notice>
            No XP rules configured. <Link href="/settings#xp-rules" className="underline">Install the default chart</Link> in Settings.
          </Notice>
        ) : (
          <p className="px-1 text-xs text-muted">
            Estimates use your XP rules (Settings → XP rules) with great-circle distance between airports. Flying Blue may credit differently for
            partner airlines, award tickets or special fares.
          </p>
        )}
      </div>
    </div>
  );
}
