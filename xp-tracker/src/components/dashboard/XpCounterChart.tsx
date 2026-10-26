'use client';
import { useEffect, useRef, useState } from 'react';
import { formatMonthLabel } from '@/domain/dates';
import type { CounterMonth } from '@/domain/qualification';
import { formatXp } from '@/lib/format';

const HEIGHT = 240;
const PAD = { top: 26, right: 12, bottom: 28, left: 40 };
const GAP = 2; // surface gap between stacked segments

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4)! * magnitude;
  return Math.ceil(value / step) * step;
}

/** Rectangle with 4px rounded top corners and a square base. */
function topRounded(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * The qualification-cycle XP counter per month: credited XP (solid) with booked XP
 * stacked on top (lighter step of the same hue) against the QC target (step line).
 * When a new QC starts the counter drops to the carried-over XP and the new level is
 * labelled above the bar.
 */
export function XpCounterChart({ series, currentMonth }: { series: CounterMonth[]; currentMonth: string }) {
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

  if (series.length === 0) return null;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const maxY = niceMax(Math.max(...series.map((m) => Math.max(m.credited + m.booked, m.target))));
  const band = innerW / series.length;
  const barW = Math.max(6, Math.min(24, band * 0.62));
  const y = (v: number) => PAD.top + innerH - (Math.max(v, 0) / maxY) * innerH;
  const xBand = (i: number) => PAD.left + i * band;
  const xBar = (i: number) => xBand(i) + (band - barW) / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const labelEvery = width < 480 ? 3 : width < 720 ? 2 : 1;
  // Label the value on the last bar of each QC and on the final month.
  const labelled = new Set(series.map((m, i) => (i === series.length - 1 || series[i + 1]?.qcStart ? i : -1)).filter((i) => i >= 0));
  const hovered = hover != null ? series[hover] : null;

  // Target as a step line that follows each QC's target.
  const targetPath = series
    .map((m, i) => `${i === 0 || series[i - 1].target !== m.target ? `M${xBand(i)},${y(m.target)}` : ''}H${xBand(i) + band}`)
    .join('');

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        className="block touch-pan-y select-none"
        role="img"
        aria-label={`XP counter by month; latest ${formatXp(series.at(-1)!.credited + series.at(-1)!.booked)} of ${formatXp(series.at(-1)!.target)} XP (${series.at(-1)!.status})`}
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

        {series.map((m, i) => {
          const creditedTop = y(m.credited);
          const totalTop = y(m.credited + m.booked);
          const hasBooked = m.booked > 0;
          const future = m.month > currentMonth;
          return (
            <g key={m.month}>
              {hover === i ? <rect x={xBand(i)} y={PAD.top} width={band} height={innerH} fill="var(--surface-2)" /> : null}
              {m.qcStart && i > 0 ? (
                <line x1={xBand(i)} x2={xBand(i)} y1={PAD.top - 12} y2={PAD.top + innerH} stroke="var(--axis)" strokeWidth={1} />
              ) : null}
              {m.qcStart || i === 0 ? <QcLabel x={xBand(i)} band={band} width={width} text={`${m.status} · ${formatXp(m.target)}`} /> : null}
              {m.credited > 0 ? (
                hasBooked ? (
                  <rect x={xBar(i)} y={creditedTop} width={barW} height={y(0) - creditedTop} fill="var(--xp-actual)" />
                ) : (
                  <path d={topRounded(xBar(i), creditedTop, barW, y(0) - creditedTop)} fill="var(--xp-actual)" />
                )
              ) : null}
              {hasBooked ? (
                <path
                  d={topRounded(xBar(i), totalTop, barW, Math.max(creditedTop - totalTop - (m.credited > 0 ? GAP : 0), 1))}
                  fill="var(--xp-booked)"
                />
              ) : null}
              {labelled.has(i) && m.credited + m.booked > 0 ? (
                <text x={xBar(i) + barW / 2} y={totalTop - 5} textAnchor="middle" className="fill-ink text-[10px] font-semibold tabular">
                  {formatXp(m.credited + m.booked)}
                </text>
              ) : null}
              {i % labelEvery === 0 ? (
                <text
                  x={xBand(i) + band / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className={`text-[10px] ${m.month === currentMonth ? 'fill-ink font-semibold' : future ? 'fill-muted' : 'fill-ink-2'}`}
                >
                  {formatMonthLabel(m.month, 'short').split(' ')[0]}
                </text>
              ) : null}
            </g>
          );
        })}

        <path d={targetPath} fill="none" stroke="var(--ink-2)" strokeWidth={1} />

        {/* Hit areas: the whole band, not only the painted bar. */}
        {series.map((m, i) => (
          <rect
            key={`hit-${m.month}`}
            x={xBand(i)}
            y={PAD.top}
            width={band}
            height={innerH}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          />
        ))}
      </svg>

      {hovered && hover != null ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(xBand(hover) + band / 2 - 88, 0), width - 184) }}
        >
          <p className="mb-1 font-medium text-ink-2">
            {formatMonthLabel(hovered.month)} · {hovered.status}
            {hovered.qcStart ? ' (new QC)' : ''}
          </p>
          <Row color="var(--xp-actual)" label="Credited" value={formatXp(hovered.credited)} />
          {hovered.booked ? <Row color="var(--xp-booked)" label="Booked" value={`+${formatXp(hovered.booked)}`} /> : null}
          <Row color="var(--ink-2)" label="Target" value={formatXp(hovered.target)} />
          <p className="mt-1 text-muted">
            {hovered.credited + hovered.booked >= hovered.target
              ? `Target reached${hovered.status === 'Platinum' || hovered.status === 'Ultimate' ? ' — 300 XP is deducted at the end of the QC' : ' — a new QC starts next month'}`
              : `${formatXp(hovered.target - hovered.credited - hovered.booked)} XP to go`}
          </p>
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap gap-4 text-xs text-ink-2">
        <Legend className="bg-xp-actual" label="Credited" />
        <Legend className="bg-xp-booked" label="Booked" />
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-px w-4 bg-ink-2" />
          QC target
        </span>
      </div>
    </div>
  );
}

/** "Gold · 300" above the first bar of a QC; flips to right-aligned near the edge. */
function QcLabel({ x, band, width, text }: { x: number; band: number; width: number; text: string }) {
  const approxWidth = text.length * 5.6;
  const flip = x + 3 + approxWidth > width - 2;
  return (
    <text
      x={flip ? Math.min(x + band, width - 2) : x + 3}
      y={PAD.top - 14}
      textAnchor={flip ? 'end' : 'start'}
      className="fill-ink-2 text-[10px] font-medium"
    >
      {text}
    </text>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-ink-2">
        <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />
        {label}
      </span>
      <strong className="tabular text-ink">{value}</strong>
    </p>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`inline-block size-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
