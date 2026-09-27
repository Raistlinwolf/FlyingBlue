'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTracker } from '@/components/data/tracker-context';
import { CyclesManager } from '@/components/settings/CyclesManager';
import { DataPanel } from '@/components/settings/DataPanel';
import { RatesManager } from '@/components/settings/RatesManager';
import { RulesManager } from '@/components/settings/RulesManager';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { Button, Card, CardTitle, PageHeader } from '@/components/ui/primitives';
import { todayIso } from '@/domain/dates';
import { sortCyclesNewestFirst } from '@/domain/periods';
import { signOut } from '@/lib/store/auth';
import { connectionLink, getConfig } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

export function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { email, settings, cycles, rules, data } = useTracker();

  async function shareConnection() {
    const config = getConfig();
    if (!config) return;
    const link = connectionLink(config);
    try {
      if (navigator.share && /Mobi|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'XP Tracker connection', url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast('Connection link copied — open it on your phone or iPad');
    } catch {
      window.prompt('Copy this link to your other device:', link);
    }
  }
  const today = todayIso();
  return (
    <>
      <PageHeader title="Settings" />
      <nav className="mb-4 flex gap-2 overflow-x-auto text-sm" aria-label="Settings sections">
        {[
          ['#preferences', 'Preferences'],
          ['#cycles', 'Cycles'],
          ['#xp-rules', 'XP rules'],
          ['#rates', 'Exchange rates'],
          ['#data', 'Import & export'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-ink-2 hover:bg-surface-2">
            {label}
          </a>
        ))}
      </nav>
      <div className="flex flex-col gap-4">
        <Card id="preferences">
          <CardTitle>Preferences</CardTitle>
          <SettingsForm settings={settings} />
        </Card>
        <Card id="cycles">
          <CardTitle>Qualification cycles</CardTitle>
          <CyclesManager cycles={sortCyclesNewestFirst(cycles)} defaults={{ status: settings.current_status, target: settings.xp_target, today }} />
        </Card>
        <Card id="xp-rules">
          <CardTitle>XP rules</CardTitle>
          <RulesManager rules={rules} />
        </Card>
        <Card id="rates">
          <CardTitle>Exchange rates</CardTitle>
          <RatesManager rates={data.exchangeRates} reportingCurrency={settings.preferred_currency} today={today} />
        </Card>
        <Card id="data">
          <CardTitle>Import & export</CardTitle>
          <DataPanel />
        </Card>
        <Card>
          <CardTitle>Account & database</CardTitle>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-ink-2">{email}</span>
              <button
                type="button"
                className="rounded-xl border border-line px-4 py-2 font-medium hover:bg-surface-2"
                onClick={async () => {
                  await signOut();
                  router.replace('/login');
                }}
              >
                Sign out
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <span className="text-xs text-ink-2">
                Use XP Tracker on another device: send it this link (contains the database URL and publishable key, not your password).
              </span>
              <Button size="sm" onClick={shareConnection}>
                Copy connection link
              </Button>
            </div>
            <p className="text-xs text-muted">
              Database: <span className="font-mono">{getConfig()?.url}</span> ·{' '}
              <Link href="/connect" className="underline">
                change connection
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
