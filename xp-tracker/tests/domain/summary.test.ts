// Financial and XP calculations. The numbered tests map to the brief's minimum list.
import { describe, expect, it } from 'vitest';
import { calendarYearPeriod, cyclePeriod, findCycleForDate, validateCycle } from '@/domain/periods';
import { computeSummary } from '@/domain/summary';
import { booking, credit, cycle, data, segment, xpTxn } from './factories';

const year2027 = calendarYearPeriod(2027, 300);

describe('computeSummary', () => {
  it('1. counts the price of a six-segment booking once', () => {
    const b = booking({ total_price: 600 });
    const legs = ['AMS', 'CPH', 'ARN', 'HEL', 'OSL', 'BLL', 'AMS'];
    const segments = legs.slice(0, -1).map((origin, i) =>
      segment(b, { origin_iata: origin, destination_iata: legs[i + 1], position: i, actual_xp: 5, segment_status: 'Flown' }),
    );
    const s = computeSummary(data({ bookings: [b], segments }), year2027, 'EUR');

    expect(s.costs.airfare).toBe(600);
    expect(s.costs.gross).toBe(600);
    expect(s.xp.flightActual).toBe(30);
    expect(s.counts.segments).toBe(6);
    expect(s.costs.costPerXp).toBe(20);
  });

  it('2. uses actual XP instead of expected XP, never both', () => {
    const b = booking();
    const flown = segment(b, { expected_xp: 5, actual_xp: 6, segment_status: 'Flown' });
    const future = segment(b, { expected_xp: 8, flight_date: '2027-06-01' });
    const s = computeSummary(data({ bookings: [b], segments: [flown, future] }), year2027, 'EUR');

    expect(s.xp.totalActual).toBe(6);
    expect(s.xp.booked).toBe(8);
    expect(s.xp.projected).toBe(14);
  });

  it('3. excludes cancelled segments and segments of cancelled bookings from projected XP', () => {
    const b = booking();
    const cancelledBooking = booking({ status: 'Cancelled' });
    const s = computeSummary(
      data({
        bookings: [b, cancelledBooking],
        segments: [
          segment(b, { expected_xp: 5 }),
          segment(b, { expected_xp: 30, segment_status: 'Cancelled' }),
          segment(cancelledBooking, { expected_xp: 12, segment_status: 'Booked' }),
        ],
      }),
      year2027,
      'EUR',
    );
    expect(s.xp.projected).toBe(5);
    expect(s.counts.segments).toBe(1);
  });

  it('4. subtracts refunds marked include_in_net_cost', () => {
    const b = booking({ total_price: 400 });
    const s = computeSummary(
      data({
        bookings: [b],
        segments: [segment(b, { actual_xp: 10, segment_status: 'Flown' })],
        credits: [credit({ booking_id: b.id, amount: 150, include_in_net_cost: true })],
      }),
      year2027,
      'EUR',
    );
    expect(s.costs.gross).toBe(400);
    expect(s.costs.creditsIncluded).toBe(150);
    expect(s.costs.net).toBe(250);
    expect(s.costs.costPerXp).toBe(25);
  });

  it('5. ignores credits not marked include_in_net_cost', () => {
    const b = booking({ total_price: 400 });
    const s = computeSummary(
      data({
        bookings: [b],
        segments: [segment(b)],
        credits: [credit({ booking_id: b.id, amount: 150, include_in_net_cost: false, credit_type: 'Voucher' })],
      }),
      year2027,
      'EUR',
    );
    expect(s.costs.net).toBe(400);
    expect(s.costs.creditsIncluded).toBe(0);
    expect(s.costs.creditsExcluded).toBe(150);
  });

  it('8. returns null cost per XP instead of dividing by zero', () => {
    const b = booking({ total_price: 250 });
    const s = computeSummary(data({ bookings: [b], segments: [segment(b)] }), year2027, 'EUR');
    expect(s.xp.totalActual).toBe(0);
    expect(s.costs.costPerXp).toBeNull();
    expect(s.costs.incrementalCostPerXp).toBeNull();
    expect(s.sources.every((r) => r.costPerXp === null)).toBe(true);

    const empty = computeSummary(data(), year2027, 'EUR');
    expect(empty.costs.costPerXp).toBeNull();
    expect(empty.costs.projectedCostPerXp).toBeNull();
  });

  it('9. counts SAF and flight XP of the same booking separately', () => {
    const b = booking({ total_price: 300 });
    const s = computeSummary(
      data({
        bookings: [b],
        segments: [segment(b, { actual_xp: 5, segment_status: 'Flown' })],
        xpTransactions: [xpTxn({ booking_id: b.id, source_type: 'SAF', cost: 60, expected_xp: 12, actual_xp: 12 })],
      }),
      year2027,
      'EUR',
    );
    expect(s.xp.flightActual).toBe(5);
    expect(s.xp.safActual).toBe(12);
    expect(s.xp.totalActual).toBe(17);
    expect(s.costs.airfare).toBe(300);
    expect(s.costs.saf).toBe(60);
    expect(s.costs.gross).toBe(360);
    const safRow = s.sources.find((r) => r.key === 'SAF')!;
    expect(safRow.costPerXp).toBe(5);
  });

  it('computes remaining and surplus against the target', () => {
    const b = booking();
    const s = computeSummary(
      data({
        bookings: [b],
        segments: [
          segment(b, { actual_xp: 178, segment_status: 'Flown' }),
          segment(b, { expected_xp: 126, flight_date: '2027-09-01' }),
        ],
      }),
      year2027,
      'EUR',
    );
    expect(s.xp.projected).toBe(304);
    expect(s.xp.remaining).toBe(0);
    expect(s.xp.remainingToEarn).toBe(122);
    expect(s.xp.surplus).toBe(4);
  });

  it('computes incremental cost against the baseline alternative', () => {
    const personal = booking({ total_price: 300, baseline_alternative_price: 200, category: 'Personal Travel' });
    const business = booking({ total_price: 500, baseline_alternative_price: 500, category: 'Business Travel' });
    const s = computeSummary(
      data({
        bookings: [personal, business],
        segments: [segment(personal, { actual_xp: 10 }), segment(business, { actual_xp: 10 })],
        credits: [credit({ booking_id: business.id, amount: 500, credit_type: 'Expense Reimbursement' })],
      }),
      year2027,
      'EUR',
    );
    expect(s.costs.net).toBe(300); // 800 − 500 reimbursed
    expect(s.costs.incremental).toBe(100); // only the 100 above the personal baseline
    expect(s.costs.incrementalCostPerXp).toBe(5);
  });

  it('excludes planned purchases from spending but reports them as planned', () => {
    const planned = booking({ total_price: 450, status: 'Planned' });
    const s = computeSummary(
      data({
        bookings: [planned],
        segments: [segment(planned, { expected_xp: 30, segment_status: 'Planned' })],
        xpTransactions: [xpTxn({ status: 'Planned', cost: 50, expected_xp: 10 })],
      }),
      year2027,
      'EUR',
    );
    expect(s.costs.gross).toBe(0);
    expect(s.costs.planned).toBe(500);
    expect(s.xp.booked).toBe(40);
    expect(s.costs.projectedCostPerXp).toBe(12.5);
  });

  it('never assumes a foreign currency is EUR', () => {
    const usd = booking({ total_price: 100, currency: 'USD' });
    const withoutRate = computeSummary(data({ bookings: [usd], segments: [segment(usd)] }), year2027, 'EUR');
    expect(withoutRate.costs.airfare).toBe(0);
    expect(withoutRate.unconverted).toEqual({ count: 1, currencies: ['USD'] });

    const withRate = computeSummary(
      data({
        bookings: [usd],
        segments: [segment(usd)],
        exchangeRates: [{ id: 'r', from_currency: 'USD', to_currency: 'EUR', rate: 0.9, effective_from: '2026-01-01', notes: null }],
      }),
      year2027,
      'EUR',
    );
    expect(withRate.costs.airfare).toBe(90);
    expect(withRate.unconverted.count).toBe(0);
  });

  it('ignores archived records', () => {
    const b = booking({ total_price: 100, archived_at: '2027-02-01T00:00:00Z' });
    const s = computeSummary(
      data({
        bookings: [b],
        segments: [segment(b, { actual_xp: 5 })],
        xpTransactions: [xpTxn({ actual_xp: 12, cost: 60, archived_at: '2027-02-01T00:00:00Z' })],
      }),
      year2027,
      'EUR',
    );
    expect(s.xp.totalActual).toBe(0);
    expect(s.costs.gross).toBe(0);
  });

  it('builds monthly and cumulative series', () => {
    const b = booking({ total_price: 200 });
    const s = computeSummary(
      data({
        bookings: [b],
        segments: [
          segment(b, { flight_date: '2027-01-02', actual_xp: 5 }),
          segment(b, { flight_date: '2027-03-05', expected_xp: 8 }),
        ],
        xpTransactions: [xpTxn({ transaction_date: '2027-02-10', actual_xp: 12, cost: 60 })],
      }),
      year2027,
      'EUR',
    );
    expect(s.months).toHaveLength(12);
    const [jan, feb, mar] = s.months;
    expect(jan).toMatchObject({ month: '2027-01', actualXp: 5, spending: 200, segments: 1, cumulativeActual: 5, cumulativeProjected: 5 });
    expect(feb).toMatchObject({ actualXp: 12, spending: 60, cumulativeActual: 17, cumulativeProjected: 17 });
    expect(mar).toMatchObject({ bookedXp: 8, cumulativeActual: 17, cumulativeProjected: 25 });
    expect(s.months[11].cumulativeProjected).toBe(25);
  });
});

describe('qualification cycles', () => {
  const fb2027 = cycle({ name: 'FB 2027', start_date: '2027-04-01', end_date: '2028-03-31' });
  const fb2026 = cycle({ name: 'FB 2026', start_date: '2026-04-01', end_date: '2027-03-31' });

  it('6. assigns transactions to the cycle containing their date', () => {
    expect(findCycleForDate('2027-03-31', [fb2026, fb2027])?.name).toBe('FB 2026');
    expect(findCycleForDate('2027-04-01', [fb2026, fb2027])?.name).toBe('FB 2027');
    expect(findCycleForDate('2028-03-31', [fb2026, fb2027])?.name).toBe('FB 2027');
    expect(findCycleForDate('2028-04-01', [fb2026, fb2027])).toBeNull();

    const b = booking({ total_price: 0 });
    const tracker = data({
      bookings: [b],
      segments: [
        segment(b, { flight_date: '2027-03-31', actual_xp: 5 }),
        segment(b, { flight_date: '2027-04-01', actual_xp: 8 }),
      ],
    });
    expect(computeSummary(tracker, cyclePeriod(fb2026), 'EUR').xp.totalActual).toBe(5);
    expect(computeSummary(tracker, cyclePeriod(fb2027), 'EUR').xp.totalActual).toBe(8);
  });

  it('7. calculates a cycle that crosses two calendar years', () => {
    const b = booking({ total_price: 500 });
    const tracker = data({
      bookings: [b],
      segments: [
        segment(b, { flight_date: '2027-11-15', actual_xp: 24 }),
        segment(b, { flight_date: '2028-02-20', actual_xp: 24 }),
      ],
      xpTransactions: [xpTxn({ transaction_date: '2028-01-02', actual_xp: 12, cost: 60 })],
    });
    const s = computeSummary(tracker, cyclePeriod(fb2027), 'EUR');
    expect(s.xp.totalActual).toBe(60);
    expect(s.costs.gross).toBe(560);
    expect(s.xp.target).toBe(300);
    expect(s.months.map((m) => m.month)).toEqual([
      '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09',
      '2027-10', '2027-11', '2027-12', '2028-01', '2028-02', '2028-03',
    ]);
    // The same data split by calendar year.
    expect(computeSummary(tracker, calendarYearPeriod(2027), 'EUR').xp.totalActual).toBe(24);
    expect(computeSummary(tracker, calendarYearPeriod(2028), 'EUR').xp.totalActual).toBe(36);
  });

  it('10. leaves historical cycles unchanged when a new cycle is created', () => {
    const b = booking({ total_price: 300 });
    const tracker = data({
      bookings: [b],
      segments: [
        segment(b, { flight_date: '2026-06-01', actual_xp: 30 }),
        segment(b, { flight_date: '2027-06-01', actual_xp: 40 }),
      ],
    });
    const before = computeSummary(tracker, cyclePeriod(fb2026), 'EUR');

    const fb2028 = cycle({ name: 'FB 2028', start_date: '2028-04-01', end_date: '2029-03-31' });
    const cycles = [fb2026, fb2027];
    expect(validateCycle(fb2028, cycles)).toBeNull();
    cycles.push(fb2028);

    const after = computeSummary(tracker, cyclePeriod(cycles[0]), 'EUR');
    expect(after).toEqual(before);
    expect(fb2026).toMatchObject({ start_date: '2026-04-01', end_date: '2027-03-31', target_xp: 300 });
  });

  it('rejects overlapping or inverted cycles', () => {
    expect(validateCycle({ start_date: '2028-03-01', end_date: '2029-02-28' }, [fb2027])).toMatch(/Overlaps/);
    expect(validateCycle({ start_date: '2029-01-01', end_date: '2028-01-01' }, [])).toMatch(/End date/);
    // Editing a cycle does not clash with itself.
    expect(validateCycle({ ...fb2027, end_date: '2028-04-30' }, [fb2027])).toBeNull();
  });
});
