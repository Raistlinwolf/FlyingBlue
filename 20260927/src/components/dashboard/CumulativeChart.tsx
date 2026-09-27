'use client';
import { useEffect, useRef, useState } from 'react';
import type { MonthRow } from '@/domain/summary';
import { formatMonthLabel } from '@/domain/dates';
import { formatXp } from '@/lib/format';

const HEIGHT = 220;
const PAD = { top: 16, right: 64, bottom: 28, left: 40 };

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4)! * magnitude;
  return Math.ceil(value / step) * step;
}

/**
 * Cumulative XP across the period: actual (solid, up to the current month),
 * projected (actual + booked) and the qualification target as a hairline.
 * Hovering snaps a crosshair to the nearest month and shows every series.
 */
export function CumulativeChart({ months, target, currentMonth }: { months: MonthRow[]; target: number | null; currentMonth: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (months.length === 0) return null;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const maxY = niceMax(Math.max(target ?? 0, ...months.map((m) => m.cumulativeProjected)));
  const x = (i: number) => PAD.left + (months.length === 1 ? innerW / 2 : (i / (months.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (Math.max(v, 0) / maxY) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

  const actualUntil = months.findIndex((m) => m.month > currentMonth);
  const actualMonths = actualUntil === -1 ? months : months.slice(0, actualUntil);
  const path = (values: number[]) => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const projectedPath = path(months.map((m) => m.cumulativeProjected));
  const actualPath = actualMonths.length > 0 ? path(actualMonths.map((m) => m.cumulativeActual)) : '';
  const lastProjected = months[months.length - 1];
  const lastActual = actualMonths[actualMonths.length - 1];
  const labelEvery = width < 480 ? 3 : width < 720 ? 2 : 1;
  const hovered = hover != null ? months[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - PAD.left) / innerW) * (months.length - 1));
    setHover(Math.min(Math.max(i, 0), months.length - 1));
  }

  // End labels: nudge apart only when they would overlap.
  const projY = y(lastProjected.cumulativeProjected);
  const actY = lastActual ? y(lastActual.cumulativeActual) : null;
  const labelsCollide = actY != null && lastActual === lastProjected && Math.abs(projY - actY) < 14;

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        className="block touch-pan-y select-none"
        role="img"
        aria-label={`Cumulative XP: ${lastActual ? formatXp(lastActual.cumulativeActual) : 0} actual, ${formatXp(lastProjected.cumulativeProjected)} projected${target != null ? `, target ${target}` : ''}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px] tabular">
              {formatXp(t)}
            </text>
          </g>
        ))}
        {months.map((m, i) =>
          i % labelEvery === 0 ? (
            <text key={m.month} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted text-[10px]">
              {formatMonthLabel(m.month, 'short').split(' ')[0]}
            </text>
          ) : null,
        )}

        {target != null && target > 0 ? (
          <g>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y(target)} y2={y(target)} stroke="var(--ink-2)" strokeWidth={1} />
            <text x={PAD.left + innerW + 6} y={y(target)} dy="0.32em" className="fill-ink-2 text-[10px]">
              Target {formatXp(target)}
            </text>
          </g>
        ) : null}

        <path d={projectedPath} fill="none" stroke="var(--xp-projected)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {actualPath ? (
          <path d={actualPath} fill="none" stroke="var(--xp-actual)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}

        <circle cx={x(months.length - 1)} cy={projY} r={4} fill="var(--xp-projected)" stroke="var(--surface)" strokeWidth={2} />
        <text x={x(months.length - 1) + 8} y={projY - (labelsCollide ? 7 : 0)} dy="0.32em" className="fill-ink text-[11px] font-semibold tabular">
          {formatXp(lastProjected.cumulativeProjected)}
        </text>
        {lastActual && actY != null ? (
          <>
            <circle cx={x(actualMonths.length - 1)} cy={actY} r={4} fill="var(--xp-actual)" stroke="var(--surface)" strokeWidth={2} />
            {actualMonths.length === months.length ? (
              <text x={x(months.length - 1) + 8} y={actY + (labelsCollide ? 7 : 0)} dy="0.32em" className="fill-ink-2 text-[11px] tabular">
                {formatXp(lastActual.cumulativeActual)}
              </text>
            ) : null}
          </>
        ) : null}

        {hover != null ? (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--axis)" strokeWidth={1} />
        ) : null}
        {/* Transparent hit area so the pointer never has to land on a line. */}
        <rect x={PAD.left - 10} y={PAD.top} width={innerW + 20} height={innerH} fill="transparent" />
      </svg>

      {hovered && hover != null ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) - 80, 0), width - 170) }}
        >
          <p className="mb-1 font-medium text-ink-2">{formatMonthLabel(hovered.month)}</p>
          <TooltipRow color="var(--xp-projected)" label="Projected" value={hovered.cumulativeProjected} />
          {hovered.month <= currentMonth ? <TooltipRow color="var(--xp-actual)" label="Actual" value={hovered.cumulativeActual} /> : null}
          {target != null ? <TooltipRow color="var(--ink-2)" label="Target" value={target} /> : null}
          <p className="mt-1 text-muted">
            This month: {hovered.actualXp} earned{hovered.bookedXp ? `, +${hovered.bookedXp} booked` : ''}
          </p>
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap gap-4 text-xs text-ink-2">
        <LegendKey color="var(--xp-actual)" label="Actual cumulative" />
        <LegendKey color="var(--xp-projected)" label="Projected (actual + booked)" />
        {target != null ? <LegendKey color="var(--ink-2)" label="Target" thin /> : null}
      </div>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-ink-2">
        <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />
        {label}
      </span>
      <strong className="tabular text-ink">{formatXp(value)}</strong>
    </p>
  );
}

function LegendKey({ color, label, thin }: { color: string; label: string; thin?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`inline-block w-4 rounded ${thin ? 'h-px' : 'h-0.5'}`} style={{ background: color }} />
      {label}
    </span>
  );
}
