// Month-by-month Flying Blue XP counter, as shown on the Flying Blue account:
//
// - Explorer / Silver / Gold: when the counter reaches the next level's threshold, the
//   next month starts a new qualification cycle (QC) at the higher level; the XP above
//   the threshold carries over.
// - Platinum (and Ultimate): the level is kept by earning 300 XP per QC; at the end of
//   the 12-month QC, 300 XP is deducted and the rest carries over.
// - A QC that ends after 12 months without an upgrade requalifies (threshold deducted)
//   or drops one level with the counter reset.
// - User-defined cycles are authoritative: when one starts, the counter restarts from
//   its starting status, target and carried-over XP.
//
// Booked (not yet credited) XP is included so the chart shows the projection; the two
// parts are tracked separately and credited XP is used first when XP is deducted.
import { addMonths, monthKey } from './dates';
import type { FlyingBlueStatus, QualificationCycle, TrackerData } from './types';
import { segmentXp, transactionXp } from './xp';

/** XP needed within a QC to reach (or keep) each level. */
export const LEVEL_THRESHOLDS: Record<FlyingBlueStatus, number> = {
  Explorer: 0,
  Silver: 100,
  Gold: 180,
  Platinum: 300,
  Ultimate: 300,
};

const LADDER: FlyingBlueStatus[] = ['Explorer', 'Silver', 'Gold', 'Platinum'];

export function nextLevel(level: FlyingBlueStatus): FlyingBlueStatus | null {
  const i = LADDER.indexOf(level);
  return i >= 0 && i < LADDER.length - 1 ? LADDER[i + 1] : null;
}

export function lowerLevel(level: FlyingBlueStatus): FlyingBlueStatus {
  if (level === 'Ultimate') return 'Platinum';
  return LADDER[Math.max(LADDER.indexOf(level) - 1, 0)];
}

/** The XP a QC at this level aims for: the next level, or requalification at the top. */
export function levelTarget(level: FlyingBlueStatus): number {
  const next = nextLevel(level);
  return next ? LEVEL_THRESHOLDS[next] : LEVEL_THRESHOLDS[level];
}

export interface CounterMonth {
  month: string;
  status: FlyingBlueStatus;
  target: number;
  /** Credited XP in the counter (incl. credited carry-over). */
  credited: number;
  /** Booked XP in the counter (projection). */
  booked: number;
  /** True when a new QC starts this month. */
  qcStart: boolean;
}

/** Credited and booked XP per month (YYYY-MM) across all live records. */
export function monthlyXp(data: TrackerData): Map<string, { credited: number; booked: number }> {
  const out = new Map<string, { credited: number; booked: number }>();
  const add = (date: string, xp: { actual: number; booked: number }) => {
    const m = monthKey(date);
    const cur = out.get(m) ?? { credited: 0, booked: 0 };
    cur.credited += xp.actual;
    cur.booked += xp.booked;
    out.set(m, cur);
  };
  const bookings = new Map(data.bookings.filter((b) => b.archived_at == null).map((b) => [b.id, b]));
  for (const s of data.segments) {
    const b = bookings.get(s.booking_id);
    if (s.archived_at == null && b) add(s.flight_date, segmentXp(s, b));
  }
  for (const t of data.xpTransactions) if (t.archived_at == null) add(t.transaction_date, transactionXp(t));
  return out;
}

interface State {
  status: FlyingBlueStatus;
  target: number;
  credited: number;
  booked: number;
  qcStart: string;
}

/** Deducts XP, credited first. */
function deduct(state: State, amount: number) {
  const fromCredited = Math.min(state.credited, amount);
  state.credited -= fromCredited;
  state.booked = Math.max(state.booked - (amount - fromCredited), 0);
}

export function xpCounterSeries(
  data: TrackerData,
  months: string[],
  cycles: QualificationCycle[],
  fallback: { status: FlyingBlueStatus; target?: number | null },
): CounterMonth[] {
  if (months.length === 0) return [];
  const xp = monthlyXp(data);
  const sorted = [...cycles].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const cycleStartingIn = new Map(sorted.map((c) => [monthKey(c.start_date), c]));
  const first = months[0];
  const last = months[months.length - 1];

  // Start from the defined cycle that contains the first shown month (so XP earned
  // earlier in that cycle is already in the counter), else from the first month.
  const containing = sorted.find((c) => monthKey(c.start_date) <= first && monthKey(c.end_date) >= first);
  const fromCycle = (c: QualificationCycle): State => ({
    status: c.starting_status,
    target: c.target_xp,
    credited: c.carried_over_xp ?? 0,
    booked: 0,
    qcStart: monthKey(c.start_date),
  });
  let state: State = containing
    ? fromCycle(containing)
    : { status: fallback.status, target: fallback.target ?? levelTarget(fallback.status), credited: 0, booked: 0, qcStart: first };

  const series: CounterMonth[] = [];
  let pending: State | null = null;
  for (let m = state.qcStart; m <= last; m = addMonths(m, 1)) {
    const defined = cycleStartingIn.get(m);
    if (defined && m !== state.qcStart) state = fromCycle(defined);
    else if (pending) state = pending;
    pending = null;

    const month = xp.get(m) ?? { credited: 0, booked: 0 };
    state.credited += month.credited;
    state.booked += month.booked;
    if (m >= first) {
      series.push({
        month: m,
        status: state.status,
        target: state.target,
        credited: state.credited,
        booked: state.booked,
        qcStart: m === state.qcStart,
      });
    }

    const total = state.credited + state.booked;
    const next = nextLevel(state.status);
    const monthsInQc = monthDiff(state.qcStart, m) + 1;
    if (next && total >= state.target) {
      // Upgrade: the new QC starts next month with the surplus.
      const carry: State = { ...state };
      deduct(carry, state.target);
      pending = { ...carry, status: next, target: levelTarget(next), qcStart: addMonths(m, 1) };
    } else if (monthsInQc >= 12) {
      const keep = LEVEL_THRESHOLDS[state.status];
      const carry: State = { ...state, qcStart: addMonths(m, 1) };
      if (state.status === 'Explorer') {
        carry.credited = 0;
        carry.booked = 0;
      } else if (total >= keep) {
        deduct(carry, keep); // e.g. Platinum: −300 at the end of the QC
      } else {
        carry.status = lowerLevel(state.status);
        carry.credited = 0;
        carry.booked = 0;
      }
      carry.target = levelTarget(carry.status);
      pending = carry;
    }
  }
  return series;
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
