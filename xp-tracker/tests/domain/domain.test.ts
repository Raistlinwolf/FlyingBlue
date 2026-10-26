import { describe, expect, it } from 'vitest';
import { bookingAttributionDate, incrementalCost, routingLines } from '@/domain/bookings';
import { calendarDays, monthGrid } from '@/domain/calendar';
import { estimateSegmentXp, haversineMiles } from '@/domain/calculator';
import { toCsv } from '@/domain/csv';
import { isIsoDate, monthsBetween } from '@/domain/dates';
import { convertAmount, safeDivide } from '@/domain/money';
import { resolvePeriod } from '@/domain/periods';
import type { Airport, ExchangeRate } from '@/domain/types';
import { segmentXp, transactionXp } from '@/domain/xp';
import { booking, cycle, data, defaultRules, segment, xpTxn } from './factories';

const airports = new Map<string, Airport>(
  (
    [
      ['AMS', 'NL', 52.308601, 4.76389],
      ['CPH', 'DK', 55.6179, 12.656],
      ['CDG', 'FR', 49.012798, 2.55],
      ['NCE', 'FR', 43.658401, 7.215869],
      ['JFK', 'US', 40.639801, -73.7789],
      ['TPE', 'TW', 25.0777, 121.233002],
      ['LAX', 'US', 33.942501, -118.407997],
    ] as const
  ).map(([iata, cc, lat, lon]) => [iata, { iata, name: iata, city: null, country_code: cc, latitude: lat, longitude: lon }]),
);

describe('xp buckets', () => {
  it('moves XP from booked to actual when actual XP is recorded', () => {
    const b = booking();
    expect(segmentXp(segment(b, { expected_xp: 5 }))).toEqual({ actual: 0, booked: 5 });
    expect(segmentXp(segment(b, { expected_xp: 5, actual_xp: 0 }))).toEqual({ actual: 0, booked: 0 });
    expect(transactionXp(xpTxn({ expected_xp: 12, status: 'Pending' }))).toEqual({ actual: 0, booked: 12 });
    expect(transactionXp(xpTxn({ expected_xp: 12, actual_xp: 12, status: 'Cancelled' }))).toEqual({ actual: 0, booked: 0 });
  });
});

describe('bookings', () => {
  it('computes incremental cost with a floor of zero', () => {
    expect(incrementalCost({ total_price: 300, baseline_alternative_price: 200 })).toBe(100);
    expect(incrementalCost({ total_price: 150, baseline_alternative_price: 200 })).toBe(0);
    expect(incrementalCost({ total_price: '99.50', baseline_alternative_price: null })).toBe(99.5);
  });

  it('attributes a booking to its first live segment, falling back to purchase date', () => {
    const b = booking({ purchase_date: '2026-11-01' });
    expect(bookingAttributionDate(b, [])).toBe('2026-11-01');
    const segs = [
      segment(b, { flight_date: '2027-05-02', position: 1 }),
      segment(b, { flight_date: '2027-05-01', position: 0, segment_status: 'Cancelled' }),
    ];
    expect(bookingAttributionDate(b, segs)).toBe('2027-05-02');
  });

  it('chains contiguous legs into one routing line', () => {
    const b = booking();
    expect(
      routingLines([
        segment(b, { origin_iata: 'AMS', destination_iata: 'CPH' }),
        segment(b, { origin_iata: 'CPH', destination_iata: 'ARN' }),
        segment(b, { origin_iata: 'ARN', destination_iata: 'HEL' }),
      ]),
    ).toEqual(['AMS → CPH → ARN → HEL']);
    expect(
      routingLines([segment(b, { origin_iata: 'AMS', destination_iata: 'CPH' }), segment(b, { origin_iata: 'ARN', destination_iata: 'HEL' })]),
    ).toEqual(['AMS → CPH', 'ARN → HEL']);
  });
});

describe('xp calculator', () => {
  const rules = defaultRules();

  it('computes great-circle distance in miles', () => {
    expect(haversineMiles(airports.get('AMS')!, airports.get('JFK')!)).toBeGreaterThan(3600);
    expect(haversineMiles(airports.get('AMS')!, airports.get('JFK')!)).toBeLessThan(3700);
  });

  it('classifies routes with the configured rules', () => {
    const est = (origin: string, destination: string, cabin: 'Economy' | 'Business' = 'Economy') =>
      estimateSegmentXp({ origin, destination, cabin, date: '2027-01-02' }, airports, rules);
    expect(est('AMS', 'CPH')).toMatchObject({ routeCategory: 'Medium', xp: 5, domestic: false });
    expect(est('CDG', 'NCE')).toMatchObject({ routeCategory: 'Domestic', xp: 2, domestic: true });
    expect(est('JFK', 'LAX', 'Business')).toMatchObject({ routeCategory: 'Domestic', xp: 6 });
    expect(est('AMS', 'JFK')).toMatchObject({ routeCategory: 'Long 2', xp: 10 });
    expect(est('AMS', 'TPE', 'Business')).toMatchObject({ routeCategory: 'Long 3', xp: 36 });
    expect(est('AMS', 'XXX')).toMatchObject({ xp: null, problem: 'unknown-destination' });
  });

  it('uses the newest rule set active on the flight date', () => {
    const newer = defaultRules().map((r) => ({ ...r, effective_from: '2028-01-01', xp: r.xp + 1 }));
    const all = [...rules.map((r) => ({ ...r, effective_to: '2027-12-31' })), ...newer];
    const on = (date: string) => estimateSegmentXp({ origin: 'AMS', destination: 'CPH', cabin: 'Economy', date }, airports, all).xp;
    expect(on('2027-12-31')).toBe(5);
    expect(on('2028-01-01')).toBe(6);
    expect(estimateSegmentXp({ origin: 'AMS', destination: 'CPH', cabin: 'Economy', date: '2017-01-01' }, airports, rules).problem).toBe('no-rule');
  });
});

describe('money', () => {
  const rates: ExchangeRate[] = [
    { id: '1', from_currency: 'USD', to_currency: 'EUR', rate: 0.9, effective_from: '2027-01-01', notes: null },
    { id: '2', from_currency: 'USD', to_currency: 'EUR', rate: 0.8, effective_from: '2027-06-01', notes: null },
    { id: '3', from_currency: 'EUR', to_currency: 'SEK', rate: 10, effective_from: '2027-01-01', notes: null },
  ];

  it('uses the latest rate on or before the date', () => {
    expect(convertAmount(100, 'USD', '2027-05-31', 'EUR', rates)).toBeCloseTo(90);
    expect(convertAmount(100, 'USD', '2027-06-01', 'EUR', rates)).toBeCloseTo(80);
    expect(convertAmount(100, 'USD', '2026-01-01', 'EUR', rates)).toBeCloseTo(90);
    expect(convertAmount(100, 'SEK', '2027-02-01', 'EUR', rates)).toBeCloseTo(10);
    expect(convertAmount(100, 'GBP', '2027-02-01', 'EUR', rates)).toBeNull();
    expect(convertAmount(100, 'EUR', '2027-02-01', 'EUR', [])).toBe(100);
  });

  it('divides safely', () => {
    expect(safeDivide(10, 0)).toBeNull();
    expect(safeDivide(0, 0)).toBeNull();
    expect(safeDivide(10, 4)).toBe(2.5);
  });
});

describe('periods and dates', () => {
  it('defaults to the cycle containing today, else the calendar year', () => {
    const c = cycle({ start_date: '2027-04-01', end_date: '2028-03-31' });
    expect(resolvePeriod(undefined, [c], '2028-01-15', 300)).toMatchObject({ kind: 'cycle', start: '2027-04-01' });
    expect(resolvePeriod(undefined, [c], '2029-01-15', 250)).toMatchObject({ kind: 'year', year: 2029, targetXp: 250 });
    expect(resolvePeriod('year:2026', [c], '2028-01-15', 300)).toMatchObject({ kind: 'year', year: 2026 });
    expect(resolvePeriod('cycle:missing', [c], '2029-01-15', null)).toMatchObject({ kind: 'year', year: 2029 });
  });

  it('validates ISO dates and month ranges', () => {
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(monthsBetween('2027-11-15', '2028-02-01')).toEqual(['2027-11', '2027-12', '2028-01', '2028-02']);
  });
});

describe('calendar', () => {
  it('builds a Monday-first grid', () => {
    const weeks = monthGrid('2027-02'); // 1 Feb 2027 is a Monday
    expect(weeks[0][0]).toBe('2027-02-01');
    expect(weeks).toHaveLength(4);
    expect(monthGrid('2027-01')[0].slice(0, 4)).toEqual([null, null, null, null]); // Friday start
  });

  it('summarises a day of an XP run', () => {
    const b = booking({ booking_name: 'Nordic run' });
    const segs = [
      segment(b, { position: 0, origin_iata: 'AMS', destination_iata: 'CPH', expected_xp: 15 }),
      segment(b, { position: 1, origin_iata: 'CPH', destination_iata: 'ARN', expected_xp: 15 }),
      segment(b, { position: 2, origin_iata: 'ARN', destination_iata: 'HEL', expected_xp: 15 }),
    ];
    const day = calendarDays(data({ bookings: [b], segments: segs }), '2027-01').get('2027-01-02')!;
    expect(day.routes).toEqual(['AMS → CPH → ARN → HEL']);
    expect(day.flights).toBe(3);
    expect(day.bookedXp).toBe(45);
    expect(day.bookingNames).toEqual(['Nordic run']);
  });
});

describe('csv', () => {
  it('produces Excel-friendly output', () => {
    const rows = [{ name: 'Run, "Nordic"', price: 12.5, flag: true, note: '=cmd' }];
    const cols = [
      { header: 'name', value: (r: (typeof rows)[0]) => r.name },
      { header: 'price', value: (r: (typeof rows)[0]) => r.price },
      { header: 'flag', value: (r: (typeof rows)[0]) => r.flag },
      { header: 'note', value: (r: (typeof rows)[0]) => r.note },
    ];
    expect(toCsv(rows, cols)).toBe('﻿name,price,flag,note\r\n"Run, ""Nordic""",12.5,TRUE,\'=cmd\r\n');
    expect(toCsv(rows, cols, 'excel-eu')).toBe('﻿name;price;flag;note\r\n"Run, ""Nordic""";12,5;TRUE;\'=cmd\r\n');
  });
});
