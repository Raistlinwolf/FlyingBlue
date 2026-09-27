import { toNumber } from '@/domain/types';

export function formatMoney(amount: number | string | null | undefined, currency: string, options: { decimals?: number } = {}): string {
  const value = toNumber(amount);
  const decimals = options.decimals ?? (Number.isInteger(value) ? 0 : 2);
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(decimals)}`;
  }
}

/** Cost per XP; "—" when there is no XP to divide by. */
export function formatCostPerXp(value: number | null, currency: string): string {
  return value == null ? '—' : formatMoney(value, currency, { decimals: 2 });
}

export function formatXp(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

export function formatSignedXp(value: number): string {
  return `${value >= 0 ? '+' : '−'}${formatXp(Math.abs(value))}`;
}
