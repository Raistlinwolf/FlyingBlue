import type { ReactNode } from 'react';

export function StatTile({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'default' | 'actual' | 'booked' | 'good';
}) {
  const marker =
    tone === 'actual' ? 'bg-xp-actual' : tone === 'booked' ? 'bg-xp-booked' : tone === 'good' ? 'bg-good' : null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-ink-2">
        {marker ? <span aria-hidden className={`size-2 rounded-full ${marker}`} /> : null}
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      {note ? <p className="text-[11px] text-muted">{note}</p> : null}
    </div>
  );
}
