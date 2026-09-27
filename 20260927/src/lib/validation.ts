// Input schemas for server actions. The database has matching CHECK constraints;
// these give friendly messages before a round trip.
import { z } from 'zod';
import { isIsoDate } from '@/domain/dates';
import {
  BOOKING_CATEGORIES,
  CABINS,
  CREDIT_TYPES,
  FB_STATUSES,
  THEMES,
  TRAVEL_STATUSES,
  XP_SOURCE_TYPES,
  XP_TRANSACTION_STATUSES,
} from '@/domain/types';

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const isoDate = z.string().refine(isIsoDate, 'Enter a valid date.');
const iata = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter airport code.');
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code.');
const money = z.coerce.number().min(0, 'Must be zero or more.').max(1_000_000);
const optionalMoney = z
  .union([z.literal(''), z.null(), z.undefined(), z.coerce.number().min(0).max(1_000_000)])
  .transform((v) => (v === '' || v == null ? null : v));
const xp = z.coerce.number().int('Whole XP only.').min(0).max(10_000);
const optionalXp = z
  .union([z.literal(''), z.null(), z.undefined(), z.coerce.number().int().min(0).max(10_000)])
  .transform((v) => (v === '' || v == null ? null : v));
const signedXp = z.coerce.number().int('Whole XP only.').min(-10_000).max(10_000);
const optionalSignedXp = z
  .union([z.literal(''), z.null(), z.undefined(), z.coerce.number().int().min(-10_000).max(10_000)])
  .transform((v) => (v === '' || v == null ? null : v));
const optionalMiles = z
  .union([z.literal(''), z.null(), z.undefined(), z.coerce.number().int().min(0).max(20_000)])
  .transform((v) => (v === '' || v == null ? null : v));
const uuid = z.uuid();

export const bookingSchema = z.object({
  booking_name: trimmed(120).min(1, 'Give the booking a name.'),
  category: z.enum(BOOKING_CATEGORIES),
  purchase_date: isoDate,
  total_price: money,
  currency,
  baseline_alternative_price: optionalMoney,
  booking_reference: optionalText(20).transform((v) => v?.toUpperCase() ?? null),
  ticket_number: optionalText(30),
  status: z.enum(TRAVEL_STATUSES),
  notes: optionalText(2000),
});
export type BookingInput = z.input<typeof bookingSchema>;

export const segmentSchema = z
  .object({
    id: uuid.optional(),
    flight_date: isoDate,
    origin_iata: iata,
    destination_iata: iata,
    marketing_airline: trimmed(40).toUpperCase().min(1, 'Airline is required.'),
    cabin: z.enum(CABINS),
    expected_xp: xp,
    actual_xp: optionalXp,
    segment_status: z.enum(TRAVEL_STATUSES),
    flight_number: optionalText(10).transform((v) => v?.toUpperCase().replace(/\s+/g, '') ?? null),
    operating_airline: optionalText(40).transform((v) => v?.toUpperCase() ?? null),
    fare_class: optionalText(2).transform((v) => v?.toUpperCase() ?? null),
    notes: optionalText(2000),
  })
  .refine((s) => s.origin_iata !== s.destination_iata, {
    message: 'Origin and destination must differ.',
    path: ['destination_iata'],
  });
export type SegmentInput = z.input<typeof segmentSchema>;

export const bookingWithSegmentsSchema = z.object({
  booking: bookingSchema,
  segments: z.array(segmentSchema).max(40),
});

export const xpTransactionSchema = z.object({
  booking_id: uuid.nullish().transform((v) => v ?? null),
  transaction_date: isoDate,
  source_type: z.enum(XP_SOURCE_TYPES),
  description: optionalText(200),
  cost: money,
  currency,
  expected_xp: signedXp,
  actual_xp: optionalSignedXp,
  status: z.enum(XP_TRANSACTION_STATUSES),
  notes: optionalText(2000),
});
export type XpTransactionInput = z.input<typeof xpTransactionSchema>;

export const creditSchema = z.object({
  booking_id: uuid.nullish().transform((v) => v ?? null),
  transaction_date: isoDate,
  credit_type: z.enum(CREDIT_TYPES),
  description: optionalText(200),
  amount: money,
  currency,
  include_in_net_cost: z.boolean(),
  notes: optionalText(2000),
});
export type CreditInput = z.input<typeof creditSchema>;

export const cycleSchema = z
  .object({
    name: trimmed(80).min(1, 'Name is required.'),
    start_date: isoDate,
    end_date: isoDate,
    starting_status: z.enum(FB_STATUSES),
    target_xp: xp,
    carried_over_xp: xp.default(0),
    notes: optionalText(2000),
  })
  .refine((c) => c.end_date >= c.start_date, { message: 'End date must be on or after the start date.', path: ['end_date'] });
export type CycleInput = z.input<typeof cycleSchema>;

export const settingsSchema = z.object({
  preferred_currency: currency,
  home_airport: z
    .union([z.literal(''), z.null(), iata])
    .transform((v) => (v ? v : null)),
  default_airline: optionalText(40).transform((v) => v?.toUpperCase() ?? null),
  default_cabin: z.enum(CABINS),
  default_category: z.enum(BOOKING_CATEGORIES),
  current_status: z.enum(FB_STATUSES),
  xp_target: xp,
  theme: z.enum(THEMES),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const xpRuleSchema = z
  .object({
    effective_from: isoDate,
    effective_to: z.union([z.literal(''), z.null(), isoDate]).transform((v) => (v ? v : null)),
    route_category: trimmed(40).min(1, 'Category is required.'),
    is_domestic: z.boolean(),
    min_distance_miles: optionalMiles,
    max_distance_miles: optionalMiles,
    cabin: z.enum(CABINS),
    xp,
    notes: optionalText(500),
  })
  .refine((r) => r.effective_to == null || r.effective_to >= r.effective_from, {
    message: 'Effective to must be after effective from.',
    path: ['effective_to'],
  })
  .refine((r) => r.min_distance_miles == null || r.max_distance_miles == null || r.max_distance_miles > r.min_distance_miles, {
    message: 'Max distance must exceed min distance.',
    path: ['max_distance_miles'],
  });
export type XpRuleInput = z.input<typeof xpRuleSchema>;

export const exchangeRateSchema = z
  .object({
    from_currency: currency,
    to_currency: currency,
    rate: z.coerce.number().positive('Rate must be positive.'),
    effective_from: isoDate,
    notes: optionalText(200),
  })
  .refine((r) => r.from_currency !== r.to_currency, { message: 'Pick two different currencies.', path: ['to_currency'] });
export type ExchangeRateInput = z.input<typeof exchangeRateSchema>;

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid input.';
  const field = issue.path.filter((p) => typeof p === 'string').at(-1);
  return field ? `${String(field).replace(/_/g, ' ')}: ${issue.message}` : issue.message;
}
