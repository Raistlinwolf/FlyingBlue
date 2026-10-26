import { describe, expect, it } from 'vitest';
import { monthsBetween } from '@/domain/dates';
import { xpCounterSeries } from '@/domain/qualification';
import { booking, cycle, data, segment, xpTxn } from './factories';

const credited = (date: string, xp: number) => xpTxn({ transaction_date: date, source_type: 'Other', expected_xp: xp, actual_xp: xp });
const booked = (date: string, xp: number) => xpTxn({ transaction_date: date, source_type: 'Other', expected_xp: xp, status: 'Pending' });
const view = (s: ReturnType<typeof xpCounterSeries>) =>
  s.map((m) => [m.month, m.status, m.target, m.credited, m.booked, m.qcStart ? 'QC' : ''].join(' '));

describe('xpCounterSeries', () => {
  it('starts a new QC the month after the target is reached, with the surplus', () => {
    const gold = cycle({ name: 'Gold', start_date: '2026-03-01', end_date: '2027-02-28', starting_status: 'Gold', target_xp: 300, carried_over_xp: 56 });
    const tracker = data({ xpTransactions: [credited('2026-04-10', 189), booked('2027-01-02', 90)] });
    const s = xpCounterSeries(tracker, monthsBetween('2026-11-01', '2027-03-31'), [gold], { status: 'Gold' });
    expect(view(s)).toEqual([
      '2026-11 Gold 300 245 0 ',
      '2026-12 Gold 300 245 0 ',
      '2027-01 Gold 300 245 90 ', // 335 ≥ 300
      '2027-02 Platinum 300 0 35 QC', // credited XP is deducted first
      '2027-03 Platinum 300 0 35 ',
    ]);
  });

  it('counts XP earned earlier in the containing cycle', () => {
    const silver = cycle({ start_date: '2025-12-01', end_date: '2026-11-30', starting_status: 'Silver', target_xp: 180, carried_over_xp: 94 });
    const tracker = data({ xpTransactions: [credited('2025-12-20', 66), credited('2026-01-17', 10), credited('2026-02-21', 66)] });
    const s = xpCounterSeries(tracker, monthsBetween('2026-01-01', '2026-03-31'), [silver], { status: 'Explorer' });
    expect(view(s)).toEqual([
      '2026-01 Silver 180 170 0 ',
      '2026-02 Silver 180 236 0 ',
      '2026-03 Gold 300 56 0 QC',
    ]);
  });

  it('deducts 300 XP from Platinum at the end of the 12-month QC', () => {
    const plat = cycle({ start_date: '2027-02-01', end_date: '2028-01-31', starting_status: 'Platinum', target_xp: 300, carried_over_xp: 35 });
    const tracker = data({ xpTransactions: [credited('2027-06-01', 320)] });
    const s = xpCounterSeries(tracker, monthsBetween('2027-12-01', '2028-02-29'), [plat], { status: 'Platinum' });
    expect(view(s)).toEqual([
      '2027-12 Platinum 300 355 0 ',
      '2028-01 Platinum 300 355 0 ', // no upgrade above Platinum: counter keeps growing
      '2028-02 Platinum 300 55 0 QC', // 355 − 300
    ]);
  });

  it('drops one level when a QC ends below the requalification threshold', () => {
    const gold = cycle({ start_date: '2025-01-01', end_date: '2025-12-31', starting_status: 'Gold', target_xp: 300 });
    const s = xpCounterSeries(data({ xpTransactions: [credited('2025-05-01', 120)] }), ['2025-12', '2026-01'], [gold], { status: 'Gold' });
    expect(view(s)).toEqual(['2025-12 Gold 300 120 0 ', '2026-01 Silver 180 0 0 QC']);
  });

  it('restarts from a user-defined cycle when it begins', () => {
    const a = cycle({ start_date: '2025-01-01', end_date: '2025-06-30', starting_status: 'Explorer', target_xp: 100 });
    const b = cycle({ start_date: '2025-07-01', end_date: '2026-06-30', starting_status: 'Silver', target_xp: 180, carried_over_xp: 7 });
    const s = xpCounterSeries(data({ xpTransactions: [credited('2025-02-01', 50)] }), ['2025-06', '2025-07'], [a, b], { status: 'Explorer' });
    expect(view(s)).toEqual(['2025-06 Explorer 100 50 0 ', '2025-07 Silver 180 7 0 QC']);
  });

  it('includes flights and ignores cancelled or archived items', () => {
    const b = booking();
    const tracker = data({
      bookings: [b],
      segments: [
        segment(b, { flight_date: '2025-03-01', actual_xp: 15 }),
        segment(b, { flight_date: '2025-03-02', expected_xp: 30, segment_status: 'Cancelled' }),
        segment(b, { flight_date: '2025-03-03', actual_xp: 99, archived_at: '2025-03-04T00:00:00Z' }),
      ],
    });
    const s = xpCounterSeries(tracker, ['2025-03'], [], { status: 'Explorer' });
    expect(view(s)).toEqual(['2025-03 Explorer 100 15 0 QC']);
  });
});
