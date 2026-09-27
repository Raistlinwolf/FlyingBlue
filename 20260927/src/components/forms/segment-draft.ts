// Client-side draft of a flight segment while it is being edited.
import type { XpEstimate } from '@/domain/calculator';
import type { Cabin, FlightSegment, TravelStatus } from '@/domain/types';
import type { SegmentInput } from '@/lib/validation';

export interface SegmentDraft {
  key: string;
  id?: string;
  flight_date: string;
  origin_iata: string;
  destination_iata: string;
  marketing_airline: string;
  cabin: Cabin;
  expected_xp: string;
  /** Once the user types an XP value, estimates stop overwriting it. */
  xpTouched: boolean;
  actual_xp: string;
  segment_status: TravelStatus;
  flight_number: string;
  operating_airline: string;
  fare_class: string;
  notes: string;
  estimate?: XpEstimate | null;
}

let seq = 0;
export const draftKey = () => `seg-${Date.now()}-${++seq}`;

export function emptyDraft(defaults: Partial<SegmentDraft> = {}): SegmentDraft {
  return {
    key: draftKey(),
    flight_date: '',
    origin_iata: '',
    destination_iata: '',
    marketing_airline: '',
    cabin: 'Economy',
    expected_xp: '',
    xpTouched: false,
    actual_xp: '',
    segment_status: 'Booked',
    flight_number: '',
    operating_airline: '',
    fare_class: '',
    notes: '',
    ...defaults,
  };
}

/** The next leg of an itinerary: same date, airline, cabin and status; starts where the last one ended. */
export function chainedDraft(previous: SegmentDraft): SegmentDraft {
  return emptyDraft({
    flight_date: previous.flight_date,
    marketing_airline: previous.marketing_airline,
    cabin: previous.cabin,
    segment_status: previous.segment_status,
    origin_iata: previous.destination_iata,
  });
}

/** Return legs: the itinerary reversed. */
export function returnDrafts(drafts: SegmentDraft[]): SegmentDraft[] {
  return [...drafts].reverse().map((d) =>
    emptyDraft({
      flight_date: d.flight_date,
      marketing_airline: d.marketing_airline,
      cabin: d.cabin,
      segment_status: d.segment_status,
      origin_iata: d.destination_iata,
      destination_iata: d.origin_iata,
    }),
  );
}

export function draftFromSegment(s: FlightSegment): SegmentDraft {
  return emptyDraft({
    id: s.id,
    flight_date: s.flight_date,
    origin_iata: s.origin_iata,
    destination_iata: s.destination_iata,
    marketing_airline: s.marketing_airline,
    cabin: s.cabin,
    expected_xp: String(s.expected_xp),
    xpTouched: true,
    actual_xp: s.actual_xp == null ? '' : String(s.actual_xp),
    segment_status: s.segment_status,
    flight_number: s.flight_number ?? '',
    operating_airline: s.operating_airline ?? '',
    fare_class: s.fare_class ?? '',
    notes: s.notes ?? '',
  });
}

export function draftToInput(d: SegmentDraft): SegmentInput {
  return {
    id: d.id,
    flight_date: d.flight_date,
    origin_iata: d.origin_iata,
    destination_iata: d.destination_iata,
    marketing_airline: d.marketing_airline,
    cabin: d.cabin,
    expected_xp: d.expected_xp === '' ? 0 : Number(d.expected_xp),
    actual_xp: d.actual_xp === '' ? null : Number(d.actual_xp),
    segment_status: d.segment_status,
    flight_number: d.flight_number || null,
    operating_airline: d.operating_airline || null,
    fare_class: d.fare_class || null,
    notes: d.notes || null,
  };
}

/** Quick client-side check so problems are shown next to the right field. */
export function draftErrors(d: SegmentDraft): Partial<Record<'flight_date' | 'origin_iata' | 'destination_iata' | 'marketing_airline' | 'expected_xp', string>> {
  const errors: ReturnType<typeof draftErrors> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.flight_date)) errors.flight_date = 'Date required';
  if (!/^[A-Z]{3}$/.test(d.origin_iata)) errors.origin_iata = '3-letter code';
  if (!/^[A-Z]{3}$/.test(d.destination_iata)) errors.destination_iata = '3-letter code';
  else if (d.destination_iata === d.origin_iata) errors.destination_iata = 'Same as origin';
  if (!d.marketing_airline.trim()) errors.marketing_airline = 'Required';
  if (d.expected_xp !== '' && !/^\d+$/.test(d.expected_xp)) errors.expected_xp = 'Whole number';
  return errors;
}
