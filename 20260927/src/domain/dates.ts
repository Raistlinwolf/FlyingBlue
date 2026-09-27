// Date helpers for ISO date strings (YYYY-MM-DD). All arithmetic runs in UTC so a
// date never shifts by a day because of the local timezone.
import type { IsoDate } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** Today's date in the given IANA timezone (defaults to the runtime's). */
export function todayIso(timeZone?: string): IsoDate {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Month key, YYYY-MM. */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Every month key from the month of `start` to the month of `end`, inclusive. */
export function monthsBetween(start: IsoDate, end: IsoDate): string[] {
  const months: string[] = [];
  const last = monthKey(end);
  for (let m = monthKey(start); m <= last; m = addMonths(m, 1)) months.push(m);
  return months;
}

export function firstDayOfMonth(month: string): IsoDate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: string): IsoDate {
  return addDays(firstDayOfMonth(addMonths(month, 1)), -1);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayMondayFirst(date: IsoDate): number {
  return (toUtc(date).getUTCDay() + 6) % 7;
}

export function formatMonthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  return toUtc(firstDayOfMonth(month)).toLocaleDateString('en-GB', {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDate(date: IsoDate, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return toUtc(date).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
}
