'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/base-path';
import { signOut } from '@/lib/store/auth';
import { getSupabase } from '@/lib/supabase/client';
import {
  CalculatorIcon,
  CalendarIcon,
  CloseIcon,
  DashboardIcon,
  HistoryIcon,
  PlaneIcon,
  PlusIcon,
  RefundIcon,
  SettingsIcon,
  SparkIcon,
  TicketIcon,
} from '@/components/ui/icons';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  { href: '/history', label: 'History', Icon: HistoryIcon },
  { href: '/calculator', label: 'Calculator', Icon: CalculatorIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

const QUICK_ADD = [
  { href: '/add/booking', label: 'Add booking', hint: 'Ticket with one or more flights', Icon: TicketIcon },
  { href: '/add/flight', label: 'Add flight', hint: 'Segment on an existing booking', Icon: PlaneIcon },
  { href: '/add/xp', label: 'Add XP', hint: 'SAF, card, promotion, other', Icon: SparkIcon },
  { href: '/add/credit', label: 'Add credit', hint: 'Refund, compensation, reimbursement', Icon: RefundIcon },
  { href: '/calculator', label: 'XP calculator', hint: 'Estimate an itinerary', Icon: CalculatorIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (menuOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [menuOpen]);


  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <Image src={asset('/icon.svg')} alt="" width={28} height={28} className="rounded-lg" unoptimized />
          <span className="text-sm font-semibold leading-tight">
            XP Tracker
            <span className="block text-xs font-normal text-muted">Flying Blue</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="mb-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-medium text-white hover:brightness-110"
        >
          <PlusIcon /> Add
        </button>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent-ink"
            >
              <Icon /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-2 pt-3 text-xs text-muted">
          <p className="truncate" title={email ?? undefined}>
            {email}
          </p>
          <button
            type="button"
            className="mt-1 text-ink-2 underline-offset-2 hover:underline"
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 md:pb-10 md:pt-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Desktop floating quick-add */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Quick add"
        className="fixed bottom-6 right-6 z-30 hidden size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:brightness-110 md:flex"
      >
        <PlusIcon width={26} height={26} />
      </button>

      {/* Mobile bottom navigation */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {[NAV[0], NAV[1]].map(({ href, label, Icon }) => (
            <MobileTab key={href} href={href} label={label} Icon={Icon} active={isActive(pathname, href)} />
          ))}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Quick add"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95"
            >
              <PlusIcon width={26} height={26} />
            </button>
          </div>
          {[NAV[2], NAV[4]].map(({ href, label, Icon }) => (
            <MobileTab key={href} href={href} label={label} Icon={Icon} active={isActive(pathname, href)} />
          ))}
        </div>
      </nav>

      {/* Quick-add menu: bottom sheet on mobile, centred dialog on desktop */}
      <dialog
        ref={dialog}
        onClose={() => setMenuOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setMenuOpen(false);
        }}
        className="mb-0 mt-auto w-full max-w-none rounded-t-3xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40 md:m-auto md:max-w-sm md:rounded-3xl"
      >
        <div className="pb-safe px-4 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Quick add</h2>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close" className="rounded-lg p-2 text-muted hover:bg-surface-2">
              <CloseIcon />
            </button>
          </div>
          <ul className="flex flex-col gap-1 pb-4">
            {QUICK_ADD.map(({ href, label, hint, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-14 items-center gap-3 rounded-2xl px-3 hover:bg-surface-2 active:bg-surface-2"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                    <Icon />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </div>
  );
}

function MobileTab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted aria-[current=page]:text-accent"
    >
      <Icon />
      {label}
    </Link>
  );
}
