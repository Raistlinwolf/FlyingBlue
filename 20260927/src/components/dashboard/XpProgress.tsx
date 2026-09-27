import type { Summary } from '@/domain/summary';
import { formatXp } from '@/lib/format';

/**
 * The dashboard's headline: credited XP (solid), booked XP (lighter step of the
 * same hue) and the projected total against the target.
 */
export function XpProgress({ xp, periodLabel }: { xp: Summary['xp']; periodLabel: string }) {
  const target = xp.target ?? 0;
  const scale = Math.max(target, xp.projected, 1);
  const actualPct = (Math.max(xp.totalActual, 0) / scale) * 100;
  const bookedPct = (Math.max(xp.booked, 0) / scale) * 100;
  const targetPct = target > 0 ? (target / scale) * 100 : null;
  const reached = target > 0 && xp.projected >= target;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label="XP progress">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-medium text-ink-2">Projected XP · {periodLabel}</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">
            {formatXp(xp.projected)}
            {xp.target != null ? <span className="text-2xl font-medium text-muted"> / {formatXp(xp.target)}</span> : null}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm bg-xp-actual" />
            <dt className="text-ink-2">Actual</dt>
            <dd className="font-semibold tabular">{formatXp(xp.totalActual)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm bg-xp-booked" />
            <dt className="text-ink-2">Booked</dt>
            <dd className="font-semibold tabular">+{formatXp(xp.booked)}</dd>
          </div>
          {xp.carriedOver ? (
            <div className="flex items-center gap-2">
              <dt className="text-ink-2">Carried over</dt>
              <dd className="font-semibold tabular">{formatXp(xp.carriedOver)}</dd>
            </div>
          ) : null}
          {xp.target != null ? (
            <div className="flex items-center gap-2">
              <dt className="text-ink-2">{reached ? 'Surplus' : 'Still to book'}</dt>
              <dd className={`font-semibold tabular ${reached ? 'text-good' : ''}`}>
                {reached ? `+${formatXp(xp.surplus ?? 0)}` : formatXp(xp.remaining ?? 0)}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div
        className="relative mt-4 h-4 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${xp.totalActual} actual XP plus ${xp.booked} booked XP${xp.target != null ? ` of a ${xp.target} XP target` : ''}`}
      >
        <div className="absolute inset-y-0 left-0 flex gap-[2px]" style={{ width: `${Math.min(actualPct + bookedPct, 100)}%` }}>
          {actualPct > 0 ? <div className="h-full rounded-l-full bg-xp-actual" style={{ width: `${(actualPct / (actualPct + bookedPct)) * 100}%` }} /> : null}
          {bookedPct > 0 ? <div className="h-full flex-1 bg-xp-booked" /> : null}
        </div>
        {targetPct != null && targetPct < 100 ? (
          <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${targetPct}%` }} aria-hidden />
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted">
        {xp.target == null
          ? 'Set an XP target in Settings to track progress.'
          : reached
            ? xp.totalActual >= target
              ? 'Target reached with credited XP.'
              : `Target covered once booked XP is credited — ${formatXp(xp.remainingToEarn ?? 0)} XP still to fly or credit.`
            : `${formatXp(xp.remaining ?? 0)} XP more needs booking to reach ${formatXp(target)}.`}
      </p>
    </section>
  );
}
