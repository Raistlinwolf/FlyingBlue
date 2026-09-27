// Dashboard aggregation for a period. Pure function of the loaded data, so every
// figure on the dashboard can be unit tested.
import { bookingAttributionDate, isPaid } from './bookings';
import { monthKey, monthsBetween } from './dates';
import { MoneyConverter, roundMoney, safeDivide } from './money';
import type { Period } from './periods';
import { isDateInPeriod } from './periods';
import type { Booking, FlightSegment, TrackerData, XpSourceType } from './types';
import { toNumber } from './types';
import { effectiveSegmentStatus, segmentXp, transactionXp } from './xp';

export const SOURCE_KEYS = ['Flights', 'SAF', 'Credit Card', 'Promotion', 'Choice Benefit', 'Other'] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export const SOURCE_LABELS: Record<SourceKey, string> = {
  Flights: 'Flights',
  SAF: 'SAF',
  'Credit Card': 'Credit cards',
  Promotion: 'Promotions',
  'Choice Benefit': 'Choice Benefits',
  Other: 'Other',
};

/** Partner, Adjustment and Other transactions are grouped under "Other". */
export function sourceKeyFor(source: XpSourceType): SourceKey {
  switch (source) {
    case 'SAF':
    case 'Credit Card':
    case 'Promotion':
    case 'Choice Benefit':
      return source;
    default:
      return 'Other';
  }
}

export interface SourceRow {
  key: SourceKey;
  label: string;
  actualXp: number;
  bookedXp: number;
  cost: number;
  costPerXp: number | null;
}

export interface MonthRow {
  month: string;
  actualXp: number;
  bookedXp: number;
  spending: number;
  segments: number;
  cumulativeActual: number;
  cumulativeProjected: number;
}

export interface Summary {
  reportingCurrency: string;
  xp: {
    flightActual: number;
    safActual: number;
    cardActual: number;
    otherActual: number;
    /** XP rolled over into the cycle (0 for calendar years). */
    carriedOver: number;
    /** Earned XP in the period plus carried-over XP. */
    totalActual: number;
    booked: number;
    projected: number;
    target: number | null;
    /** Still needed after counting booked XP. */
    remaining: number | null;
    /** Still needed counting only credited XP. */
    remainingToEarn: number | null;
    surplus: number | null;
  };
  costs: {
    airfare: number;
    saf: number;
    cardFees: number;
    otherXpCosts: number;
    gross: number;
    creditsIncluded: number;
    creditsExcluded: number;
    net: number;
    incremental: number;
    planned: number;
    costPerXp: number | null;
    incrementalCostPerXp: number | null;
    projectedCostPerXp: number | null;
  };
  sources: SourceRow[];
  months: MonthRow[];
  counts: { segments: number; flownSegments: number; bookings: number };
  unconverted: { count: number; currencies: string[] };
}

export function computeSummary(data: TrackerData, period: Period, reportingCurrency: string): Summary {
  const money = new MoneyConverter(reportingCurrency, data.exchangeRates);
  const bookings = new Map<string, Booking>();
  for (const b of data.bookings) if (b.archived_at == null) bookings.set(b.id, b);

  const segmentsByBooking = new Map<string, FlightSegment[]>();
  for (const s of data.segments) {
    if (s.archived_at != null || !bookings.has(s.booking_id)) continue;
    const list = segmentsByBooking.get(s.booking_id) ?? [];
    list.push(s);
    segmentsByBooking.set(s.booking_id, list);
  }
  const attributionDate = new Map<string, string>();
  for (const b of bookings.values()) attributionDate.set(b.id, bookingAttributionDate(b, segmentsByBooking.get(b.id) ?? []));

  const months = new Map<string, MonthRow>(
    monthsBetween(period.start, period.end).map((m) => [
      m,
      { month: m, actualXp: 0, bookedXp: 0, spending: 0, segments: 0, cumulativeActual: 0, cumulativeProjected: 0 },
    ]),
  );
  const monthOf = (date: string) => months.get(monthKey(date));

  const sources = new Map<SourceKey, SourceRow>(
    SOURCE_KEYS.map((k) => [k, { key: k, label: SOURCE_LABELS[k], actualXp: 0, bookedXp: 0, cost: 0, costPerXp: null }]),
  );
  const counts = { segments: 0, flownSegments: 0, bookings: 0 };

  // --- Flight XP (by flight date) -------------------------------------------------
  for (const [bookingId, segments] of segmentsByBooking) {
    const booking = bookings.get(bookingId)!;
    for (const s of segments) {
      if (!isDateInPeriod(s.flight_date, period)) continue;
      const status = effectiveSegmentStatus(s, booking);
      const xp = segmentXp(s, booking);
      const row = sources.get('Flights')!;
      row.actualXp += xp.actual;
      row.bookedXp += xp.booked;
      const month = monthOf(s.flight_date);
      if (month) {
        month.actualXp += xp.actual;
        month.bookedXp += xp.booked;
      }
      if (status !== 'Cancelled') {
        counts.segments += 1;
        if (month) month.segments += 1;
        if (status === 'Flown') counts.flownSegments += 1;
      }
    }
  }

  // --- Non-flight XP and its cost (by transaction date) --------------------------
  let saf = 0;
  let cardFees = 0;
  let otherXpCosts = 0;
  let planned = 0;
  for (const t of data.xpTransactions) {
    if (t.archived_at != null || !isDateInPeriod(t.transaction_date, period)) continue;
    const key = sourceKeyFor(t.source_type);
    const row = sources.get(key)!;
    const xp = transactionXp(t);
    row.actualXp += xp.actual;
    row.bookedXp += xp.booked;
    const month = monthOf(t.transaction_date);
    if (month) {
      month.actualXp += xp.actual;
      month.bookedXp += xp.booked;
    }

    const cost = money.convert(toNumber(t.cost), t.currency, t.transaction_date);
    if (!isPaid(t.status)) {
      planned += cost;
      continue;
    }
    row.cost += cost;
    if (month) month.spending += cost;
    if (t.source_type === 'SAF') saf += cost;
    else if (t.source_type === 'Credit Card') cardFees += cost;
    else otherXpCosts += cost;
  }

  // --- Credits ---------------------------------------------------------------------
  // Credits linked to a booking follow the booking's attribution date; others use
  // their own date. Only include_in_net_cost credits reduce spending.
  const linkedCredits = new Map<string, number>();
  let creditsIncluded = 0;
  let creditsExcluded = 0;
  let unlinkedIncluded = 0;
  for (const c of data.credits) {
    if (c.archived_at != null) continue;
    const linked = c.booking_id != null && bookings.has(c.booking_id);
    const date = linked ? attributionDate.get(c.booking_id!)! : c.transaction_date;
    if (!isDateInPeriod(date, period)) continue;
    const amount = money.convert(toNumber(c.amount), c.currency, c.transaction_date);
    if (!c.include_in_net_cost) {
      creditsExcluded += amount;
      continue;
    }
    creditsIncluded += amount;
    const month = monthOf(date);
    if (month) month.spending -= amount;
    if (linked) linkedCredits.set(c.booking_id!, (linkedCredits.get(c.booking_id!) ?? 0) + amount);
    else unlinkedIncluded += amount;
  }

  // --- Airfare: once per booking, never per segment -----------------------------
  let airfare = 0;
  let incrementalAirfare = 0;
  let linkedCreditsInPeriod = 0;
  for (const b of bookings.values()) {
    const date = attributionDate.get(b.id)!;
    if (!isDateInPeriod(date, period)) continue;
    const price = money.convert(toNumber(b.total_price), b.currency, date);
    if (!isPaid(b.status)) {
      planned += price;
      continue;
    }
    counts.bookings += 1;
    airfare += price;
    const month = monthOf(date);
    if (month) month.spending += price;

    const credits = linkedCredits.get(b.id) ?? 0;
    linkedCreditsInPeriod += credits;
    const baseline = money.convert(toNumber(b.baseline_alternative_price), b.currency, date);
    incrementalAirfare += Math.max(price - credits - baseline, 0);
  }
  sources.get('Flights')!.cost = airfare - linkedCreditsInPeriod;

  // --- Totals ----------------------------------------------------------------------
  const flights = sources.get('Flights')!;
  const flightActual = flights.actualXp;
  const safActual = sources.get('SAF')!.actualXp;
  const cardActual = sources.get('Credit Card')!.actualXp;
  const carriedOver = period.carriedOverXp;
  let totalActual = carriedOver;
  let booked = 0;
  for (const row of sources.values()) {
    totalActual += row.actualXp;
    booked += row.bookedXp;
    row.cost = roundMoney(row.cost);
    row.costPerXp = safeDivide(row.cost, row.actualXp);
  }
  const projected = totalActual + booked;
  const target = period.targetXp;

  const gross = airfare + saf + cardFees + otherXpCosts;
  const net = gross - creditsIncluded;
  const incremental = Math.max(incrementalAirfare + saf + cardFees + otherXpCosts - unlinkedIncluded, 0);

  let cumulativeActual = carriedOver;
  let cumulativeProjected = carriedOver;
  const monthRows = [...months.values()].map((m) => {
    cumulativeActual += m.actualXp;
    cumulativeProjected += m.actualXp + m.bookedXp;
    return { ...m, spending: roundMoney(m.spending), cumulativeActual, cumulativeProjected };
  });

  return {
    reportingCurrency,
    xp: {
      flightActual,
      safActual,
      cardActual,
      otherActual: totalActual - carriedOver - flightActual - safActual - cardActual,
      carriedOver,
      totalActual,
      booked,
      projected,
      target,
      remaining: target == null ? null : Math.max(target - projected, 0),
      remainingToEarn: target == null ? null : Math.max(target - totalActual, 0),
      surplus: target == null ? null : Math.max(projected - target, 0),
    },
    costs: {
      airfare: roundMoney(airfare),
      saf: roundMoney(saf),
      cardFees: roundMoney(cardFees),
      otherXpCosts: roundMoney(otherXpCosts),
      gross: roundMoney(gross),
      creditsIncluded: roundMoney(creditsIncluded),
      creditsExcluded: roundMoney(creditsExcluded),
      net: roundMoney(net),
      incremental: roundMoney(incremental),
      planned: roundMoney(planned),
      costPerXp: safeDivide(net, totalActual),
      incrementalCostPerXp: safeDivide(incremental, totalActual),
      projectedCostPerXp: safeDivide(net + planned, projected),
    },
    sources: [...sources.values()],
    months: monthRows,
    counts,
    unconverted: {
      count: [...money.unconverted.values()].reduce((a, b) => a + b, 0),
      currencies: [...money.unconverted.keys()].sort(),
    },
  };
}
