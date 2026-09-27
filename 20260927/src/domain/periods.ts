// Reporting periods: a calendar year or a user-defined Flying Blue qualification
// cycle. Membership is always derived from dates, never stored on records.
import type { IsoDate, QualificationCycle, TrackerData } from './types';

export type Period =
  | {
      kind: 'year';
      key: string;
      year: number;
      start: IsoDate;
      end: IsoDate;
      label: string;
      targetXp: number | null;
      carriedOverXp: number;
    }
  | {
      kind: 'cycle';
      key: string;
      cycleId: string;
      start: IsoDate;
      end: IsoDate;
      label: string;
      targetXp: number | null;
      /** XP rolled over into the cycle; counts only in cycle views. */
      carriedOverXp: number;
      cycle: QualificationCycle;
    };

export function calendarYearPeriod(year: number, targetXp: number | null = null): Period {
  return {
    kind: 'year',
    key: `year:${year}`,
    year,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: String(year),
    targetXp,
    carriedOverXp: 0,
  };
}

export function cyclePeriod(cycle: QualificationCycle): Period {
  return {
    kind: 'cycle',
    key: `cycle:${cycle.id}`,
    cycleId: cycle.id,
    start: cycle.start_date,
    end: cycle.end_date,
    label: cycle.name,
    targetXp: cycle.target_xp,
    carriedOverXp: cycle.carried_over_xp ?? 0,
    cycle,
  };
}

/** Inclusive on both ends. */
export function isDateInPeriod(date: IsoDate, period: Pick<Period, 'start' | 'end'>): boolean {
  return date >= period.start && date <= period.end;
}

export function findCycleForDate(date: IsoDate, cycles: QualificationCycle[]): QualificationCycle | null {
  return cycles.find((c) => date >= c.start_date && date <= c.end_date) ?? null;
}

/**
 * Validates a new or edited cycle against the existing ones. Mirrors the database
 * exclusion constraint so the UI can show a helpful message before saving.
 */
export function validateCycle(
  candidate: Pick<QualificationCycle, 'start_date' | 'end_date'> & { id?: string },
  existing: QualificationCycle[],
): string | null {
  if (candidate.end_date < candidate.start_date) return 'End date must be on or after the start date.';
  const clash = existing.find(
    (c) => c.id !== candidate.id && candidate.start_date <= c.end_date && candidate.end_date >= c.start_date,
  );
  return clash ? `Overlaps with “${clash.name}” (${clash.start_date} – ${clash.end_date}).` : null;
}

export function sortCyclesNewestFirst(cycles: QualificationCycle[]): QualificationCycle[] {
  return [...cycles].sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
}

/** Years that contain any data, plus the current year, newest first. */
export function availableYears(data: TrackerData, today: IsoDate): number[] {
  const years = new Set<number>([Number(today.slice(0, 4))]);
  for (const s of data.segments) years.add(Number(s.flight_date.slice(0, 4)));
  for (const t of data.xpTransactions) years.add(Number(t.transaction_date.slice(0, 4)));
  for (const c of data.credits) years.add(Number(c.transaction_date.slice(0, 4)));
  for (const b of data.bookings) years.add(Number(b.purchase_date.slice(0, 4)));
  return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}

/**
 * Resolves a `?period=` value ("year:2027" or "cycle:<id>"). Without a valid value the
 * cycle containing today wins, otherwise the current calendar year.
 */
export function resolvePeriod(
  param: string | undefined,
  cycles: QualificationCycle[],
  today: IsoDate,
  defaultTargetXp: number | null,
): Period {
  if (param?.startsWith('cycle:')) {
    const cycle = cycles.find((c) => c.id === param.slice('cycle:'.length));
    if (cycle) return cyclePeriod(cycle);
  }
  if (param?.startsWith('year:')) {
    const year = Number(param.slice('year:'.length));
    if (Number.isInteger(year) && year > 1900 && year < 3000) return calendarYearPeriod(year, defaultTargetXp);
  }
  const current = findCycleForDate(today, cycles);
  if (current) return cyclePeriod(current);
  return calendarYearPeriod(Number(today.slice(0, 4)), defaultTargetXp);
}
