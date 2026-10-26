import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110',
};
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  pending,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; pending?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass(variant, size, className)}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function Card({ className = '', children, ...props }: ComponentProps<'section'>) {
  return (
    <section {...props} className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Field({
  label,
  hint,
  error,
  className = '',
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const statusStyles: Record<string, string> = {
  Planned: 'bg-surface-2 text-ink-2',
  Booked: 'bg-accent-soft text-accent-ink',
  Flown: 'bg-[color-mix(in_srgb,var(--good)_15%,transparent)] text-good',
  Credited: 'bg-[color-mix(in_srgb,var(--good)_15%,transparent)] text-good',
  Pending: 'bg-warning-bg text-warning-ink',
  Cancelled: 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger line-through',
  Archived: 'bg-surface-2 text-muted',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${statusStyles[status] ?? statusStyles.Planned}`}>
      {status}
    </span>
  );
}

/** XP figure styled by state: solid for credited, outlined for booked. */
export function XpBadge({ actual, booked }: { actual: number; booked: number }) {
  if (actual === 0 && booked === 0) return <span className="text-xs text-muted">0 XP</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold tabular">
      {actual !== 0 ? <span className="rounded-md bg-xp-actual px-1.5 py-0.5 text-white">{actual} XP</span> : null}
      {booked !== 0 ? (
        <span className="rounded-md border border-dashed border-xp-actual px-1.5 py-0.5 text-accent-ink">+{booked}</span>
      ) : null}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="mt-2 text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = 'warning', children }: { tone?: 'warning' | 'info'; children: ReactNode }) {
  return (
    <div
      role="note"
      className={`rounded-xl px-3 py-2 text-sm ${tone === 'warning' ? 'bg-warning-bg text-warning-ink' : 'bg-accent-soft text-accent-ink'}`}
    >
      {children}
    </div>
  );
}
