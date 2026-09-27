// Currency conversion into the reporting currency. Amounts are stored in their
// original currency; conversion only happens when aggregating.
import type { ExchangeRate, IsoDate } from './types';
import { toNumber } from './types';

/**
 * Converts an amount to the reporting currency using the most recent rate on or
 * before `date` (falling back to the earliest known rate). Returns null when no
 * rate exists, so callers can report it instead of silently treating it as EUR.
 */
export function convertAmount(
  amount: number,
  currency: string,
  date: IsoDate,
  reportingCurrency: string,
  rates: ExchangeRate[],
): number | null {
  if (currency === reportingCurrency || amount === 0) return amount;

  const direct = rates.filter((r) => r.from_currency === currency && r.to_currency === reportingCurrency);
  const inverse = rates.filter((r) => r.from_currency === reportingCurrency && r.to_currency === currency);
  const candidates = [
    ...direct.map((r) => ({ date: r.effective_from, factor: toNumber(r.rate) })),
    ...inverse.map((r) => ({ date: r.effective_from, factor: 1 / toNumber(r.rate) })),
  ].filter((c) => Number.isFinite(c.factor) && c.factor > 0);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const onOrBefore = candidates.filter((c) => c.date <= date);
  const chosen = onOrBefore.length > 0 ? onOrBefore[onOrBefore.length - 1] : candidates[0];
  return amount * chosen.factor;
}

/** Division that returns null instead of Infinity/NaN when the denominator is zero. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Collects converted amounts and remembers which ones could not be converted. */
export class MoneyConverter {
  readonly unconverted = new Map<string, number>();

  constructor(
    readonly reportingCurrency: string,
    private readonly rates: ExchangeRate[],
  ) {}

  convert(amount: number, currency: string, date: IsoDate): number {
    const converted = convertAmount(amount, currency, date, this.reportingCurrency, this.rates);
    if (converted == null) {
      this.unconverted.set(currency, (this.unconverted.get(currency) ?? 0) + 1);
      return 0;
    }
    return converted;
  }
}
