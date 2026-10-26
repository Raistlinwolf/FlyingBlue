// Excel "Earning Log" import. The rows below are invented sample data in the same
// layout as the original tracker (no real travel history in the repository).
import { describe, expect, it } from 'vitest';
import {
  cabinFromCategory,
  creditedXpEvents,
  parseAmount,
  parseDate,
  parseEarningLog,
  planImport,
  stableUuid,
  suggestCycles,
} from '@/domain/earning-log';
import { cyclePeriod } from '@/domain/periods';
import { computeSummary } from '@/domain/summary';
import type { Booking, FlightSegment, XpTransaction } from '@/domain/types';
import { cycle } from './factories';

const HEADER = ['年度', '分類', '(預計)日期', '起飛', '降落', '價格', '飛行XP', 'SAF價格', 'SAF XP', '信用卡年費', '信用卡XP', '其他XP'];
const SHEET: unknown[][] = [
  HEADER,
  ['2025', '經濟艙', '2025-03-10', 'AMS', 'BLL', '120', '5', '0', '0', '0', '0', '0'],
  ['2025', '經濟艙', '2025-03-12', 'BLL', 'AMS', '0', '5', '0', '0', '0', '0', '0'],
  ['2025', 'AMEX 金卡', '2025-04-01', '-', '-', '0', '0', '0', '0', '198', '30', '0'],
  ['2025', '商務艙', '2025-05-02', 'AMS', 'CDG', '1800', '15', '60', '12', '0', '0', '0'],
  ['2025', '商務艙', '2025-05-02', 'CDG', 'JFK', '0', '30', '0', '0', '0', '0', '0'],
  ['2025', '商務艙', '2025-05-09', 'JFK', 'CDG', '0', '30', '0', '0', '0', '0', '0'],
  ['2025', '商務艙', '2025-05-09', 'CDG', 'AMS', '0', '15', '0', '0', '0', '0', '0'],
  ['2025', 'Accor ALL', '2025-06-01', '-', '-', '0', '0', '0', '0', '0', '0', '5'],
  ['2025', '經濟艙', '2025-06-20', 'AMS', 'OSL', '0', '5', '0', '0', '0', '0', '0'],
  [],
  ['2026', '商務艙', '2026-02-01', 'AMS', 'HEL', '400', '45', '0', '0', '0', '0', '0'],
  ['2026', '商務艙', '2026-02-04', 'HEL', 'AMS', '300', '45', '0', '0', '0', '0', '0'],
];

const options = { today: '2025-12-31', currency: 'EUR', category: 'XP Run' as const, airline: 'Unknown' };

describe('parsing', () => {
  it('reads amounts, dates and cabins in the formats the sheet uses', () => {
    expect(parseAmount('350.83')).toBe(350.83);
    expect(parseAmount('€ 1,300')).toBe(1300);
    expect(parseAmount('2,5')).toBe(2.5);
    expect(parseAmount('-')).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseDate('2025-03-06')).toBe('2025-03-06');
    expect(parseDate('2025/3/6')).toBe('2025-03-06');
    expect(parseDate(45722)).toBe('2025-03-06'); // Excel serial date
    expect(parseDate('soon')).toBeNull();
    expect(cabinFromCategory('經濟艙')).toBe('Economy');
    expect(cabinFromCategory('商務艙')).toBe('Business');
    expect(cabinFromCategory('Premium Economy')).toBe('Premium Economy');
    expect(cabinFromCategory('AMEX 金卡')).toBeNull();
  });

  it('finds the header row and skips blank lines', () => {
    const { rows, warnings } = parseEarningLog([['My tracker'], [], ...SHEET]);
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(11);
    expect(rows[0]).toMatchObject({ line: 4, date: '2025-03-10', origin: 'AMS', destination: 'BLL', price: 120, flightXp: 5 });
    expect(rows[2]).toMatchObject({ origin: null, destination: null, cardFee: 198, cardXp: 30 });
  });

  it('produces stable, UUID-shaped ids', () => {
    expect(stableUuid('a')).toBe(stableUuid('a'));
    expect(stableUuid('a')).not.toBe(stableUuid('b'));
    expect(stableUuid('a')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('planImport', () => {
  const plan = planImport(parseEarningLog(SHEET).rows, options);

  it('groups segments into bookings by price and continuity', () => {
    expect(plan.bookings.map((b) => [b.booking_name, b.total_price, b.status])).toEqual([
      ['AMS–BLL–AMS', 120, 'Flown'],
      ['AMS–CDG–JFK–CDG–AMS', 1800, 'Flown'],
      ['AMS–OSL', 0, 'Flown'],
      ['AMS–HEL', 400, 'Booked'],
      ['HEL–AMS', 300, 'Booked'],
    ]);
    expect(plan.segments).toHaveLength(9);
    const nyc = plan.segments.filter((s) => s.booking_id === plan.bookings[1].id);
    expect(nyc.map((s) => s.position)).toEqual([0, 1, 2, 3]);
    expect(nyc.every((s) => s.cabin === 'Business')).toBe(true);
  });

  it('splits XP into flights, SAF, credit card and partner sources', () => {
    const xp = plan.xpTransactions.map((t) => [t.source_type, t.expected_xp, t.cost, t.booking_id != null]);
    expect(xp).toEqual([
      ['Credit Card', 30, 198, false],
      ['SAF', 12, 60, true],
      ['Partner', 5, 0, false],
    ]);
    expect(plan.xpTransactions[1].booking_id).toBe(plan.bookings[1].id);
  });

  it('marks past rows as credited and future rows as booked', () => {
    const future = plan.segments.filter((s) => s.flight_date > options.today);
    expect(future.every((s) => s.actual_xp == null && s.segment_status === 'Booked')).toBe(true);
    const past = plan.segments.filter((s) => s.flight_date <= options.today);
    expect(past.every((s) => s.actual_xp === s.expected_xp && s.segment_status === 'Flown')).toBe(true);
  });

  it('is idempotent: the same sheet yields the same ids', () => {
    const again = planImport(parseEarningLog(SHEET).rows, options);
    expect(again.bookings.map((b) => b.id)).toEqual(plan.bookings.map((b) => b.id));
    expect(again.segments.map((s) => s.id)).toEqual(plan.segments.map((s) => s.id));
    expect(new Set(plan.segments.map((s) => s.id)).size).toBe(plan.segments.length);
  });

  it('totals match the sheet once loaded into the dashboard', () => {
    const data = {
      bookings: plan.bookings.map((b) => ({ ...b, booking_reference: null, ticket_number: null, baseline_alternative_price: null, archived_at: null })) as Booking[],
      segments: plan.segments.map((s) => ({ ...s, flight_number: null, operating_airline: null, fare_class: null, archived_at: null })) as FlightSegment[],
      xpTransactions: plan.xpTransactions.map((t) => ({ ...t, archived_at: null })) as XpTransaction[],
      credits: [],
      exchangeRates: [],
    };
    const period = cyclePeriod(cycle({ start_date: '2025-01-01', end_date: '2026-12-31' }));
    const s = computeSummary(data, period, 'EUR');
    expect(s.xp.flightActual).toBe(105);
    expect(s.xp.totalActual).toBe(152); // 105 flights + 12 SAF + 30 card + 5 Accor
    expect(s.xp.booked).toBe(90);
    expect(s.costs.gross).toBe(120 + 1800 + 400 + 300 + 60 + 198);
  });
});

describe('suggestCycles', () => {
  it('starts a new cycle the month after reaching a level and carries the surplus', () => {
    const events = [
      { date: '2025-03-10', xp: 10 },
      { date: '2025-05-02', xp: 95 }, // 105 ≥ 100 → Silver
      { date: '2025-06-15', xp: 100 }, // 5 + 100 = 105
      { date: '2025-09-01', xp: 90 }, // 195 ≥ 180 → Gold
      { date: '2026-01-10', xp: 60 },
    ];
    const cycles = suggestCycles(events, { startStatus: 'Explorer', startMonth: '2025-03', today: '2026-02-15' });
    expect(cycles.map((c) => [c.starting_status, c.start_date, c.end_date, c.target_xp, c.carried_over_xp])).toEqual([
      ['Explorer', '2025-03-01', '2025-05-31', 100, 0],
      ['Silver', '2025-06-01', '2025-09-30', 180, 5],
      ['Gold', '2025-10-01', '2026-09-30', 300, 15],
    ]);
  });

  it('keeps the level with surplus after a full year, or steps down', () => {
    const keep = suggestCycles([{ date: '2025-02-01', xp: 320 }], { startStatus: 'Platinum', startMonth: '2025-01', today: '2026-03-01' });
    expect(keep.map((c) => [c.starting_status, c.start_date, c.carried_over_xp])).toEqual([
      ['Platinum', '2025-01-01', 0],
      ['Platinum', '2026-01-01', 20],
    ]);
    const drop = suggestCycles([{ date: '2025-02-01', xp: 50 }], { startStatus: 'Gold', startMonth: '2025-01', today: '2026-03-01' });
    expect(drop.map((c) => c.starting_status)).toEqual(['Gold', 'Silver']);
  });

  it('ignores future (booked) XP so the current cycle is not cut short', () => {
    const plan = planImport(parseEarningLog(SHEET).rows, options);
    const cycles = suggestCycles(creditedXpEvents(plan), { startStatus: 'Explorer', startMonth: '2025-03', today: options.today });
    // 10 (Mar) + 30 (Apr card) = 40; May +102 → 142 ≥ 100 → Silver from June with 42.
    expect(cycles.map((c) => [c.starting_status, c.start_date, c.carried_over_xp])).toEqual([
      ['Explorer', '2025-03-01', 0],
      ['Silver', '2025-06-01', 42],
    ]);
    expect(cycles[1].end_date).toBe('2026-05-31');
  });

  it('adds carried-over XP to the cycle totals only', () => {
    const c = cycle({ start_date: '2026-03-01', end_date: '2027-02-28', carried_over_xp: 56 });
    const empty = { bookings: [], segments: [], xpTransactions: [], credits: [], exchangeRates: [] };
    const s = computeSummary(empty, cyclePeriod(c), 'EUR');
    expect(s.xp.carriedOver).toBe(56);
    expect(s.xp.totalActual).toBe(56);
    expect(s.xp.otherActual).toBe(0);
    expect(s.months[0].cumulativeActual).toBe(56);
    expect(s.costs.costPerXp).toBe(0);
  });
});
