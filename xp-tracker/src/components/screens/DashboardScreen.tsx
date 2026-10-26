'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CostSummary } from '@/components/dashboard/CostSummary';
import { MonthlyTable } from '@/components/dashboard/MonthlyTable';
import { PeriodSelector } from '@/components/dashboard/PeriodSelector';
import { SourceBreakdown } from '@/components/dashboard/SourceBreakdown';
import { StatTile } from '@/components/dashboard/StatTile';
import { XpCounterChart } from '@/components/dashboard/XpCounterChart';
import { XpProgress } from '@/components/dashboard/XpProgress';
import { useTracker } from '@/components/data/tracker-context';
import { Card, CardTitle, LinkButton, PageHeader } from '@/components/ui/primitives';
import { formatDate, monthKey, todayIso } from '@/domain/dates';
import {
  availableYears,
  calendarYearPeriod,
  cyclePeriod,
  findCycleForDate,
  resolvePeriod,
  sortCyclesNewestFirst,
} from '@/domain/periods';
import { xpCounterSeries } from '@/domain/qualification';
import { computeSummary } from '@/domain/summary';
import { formatXp } from '@/lib/format';

export function DashboardScreen() {
  const { data, cycles, settings } = useTracker();
  const params = useSearchParams();
  const today = todayIso();
  const period = resolvePeriod(params.get('period') ?? undefined, cycles, today, settings.xp_target);
  const summary = computeSummary(data, period, settings.preferred_currency);
  const { xp, counts } = summary;
  const counter = xpCounterSeries(
    data,
    summary.months.map((m) => m.month),
    cycles,
    { status: settings.current_status },
  );

  const cycleOptions = sortCyclesNewestFirst(cycles).map((c) => ({ key: cyclePeriod(c).key, label: c.name }));
  const yearOptions = availableYears(data, today).map((y) => ({ key: calendarYearPeriod(y).key, label: String(y) }));
  const currentCycle = findCycleForDate(today, cycles);
  const hasData = data.bookings.length + data.xpTransactions.length > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${formatDate(period.start)} – ${formatDate(period.end)}${period.kind === 'cycle' ? ` · started as ${period.cycle.starting_status}` : ''}`}
        actions={
          <PeriodSelector
            value={period.key}
            cycles={cycleOptions}
            years={yearOptions}
            defaultCycle={currentCycle ? cyclePeriod(currentCycle).key : undefined}
            defaultYear={calendarYearPeriod(Number(today.slice(0, 4))).key}
          />
        }
      />

      {!hasData ? (
        <Card className="mb-4">
          <p className="font-medium">Welcome! Start by logging a booking — or import your Excel tracker.</p>
          <p className="mt-1 text-sm text-ink-2">
            Set your home airport, status and qualification cycle in{' '}
            <Link href="/settings" className="text-accent-ink underline">
              Settings
            </Link>{' '}
            so entry forms are prefilled.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton href="/add/booking" variant="primary">
              Add booking
            </LinkButton>
            <LinkButton href="/settings#data">Import from Excel</LinkButton>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
        <XpProgress xp={xp} periodLabel={period.label} />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Flight XP" value={formatXp(xp.flightActual)} tone="actual" note={`${counts.flownSegments} flown · ${counts.segments} flights`} />
          <StatTile label="SAF XP" value={formatXp(xp.safActual)} tone="actual" />
          <StatTile label="Credit card XP" value={formatXp(xp.cardActual)} tone="actual" />
          <StatTile label="Other XP" value={formatXp(xp.otherActual)} tone="actual" note="Promotions, Choice, partners" />
          <StatTile
            label="Total actual XP"
            value={formatXp(xp.totalActual)}
            tone="actual"
            note={xp.carriedOver ? `incl. ${formatXp(xp.carriedOver)} carried over` : undefined}
          />
          <StatTile label="Booked future XP" value={`+${formatXp(xp.booked)}`} tone="booked" note="Not yet credited" />
          <StatTile label="Projected total" value={formatXp(xp.projected)} note="Actual + booked" />
          <StatTile label="XP target" value={xp.target == null ? '—' : formatXp(xp.target)} note={period.kind === 'year' ? 'From settings' : 'From cycle'} />
          <StatTile
            label="XP remaining"
            value={xp.remaining == null ? '—' : formatXp(xp.remaining)}
            note={xp.remainingToEarn != null ? `${formatXp(xp.remainingToEarn)} excl. booked` : undefined}
          />
          <StatTile label="XP surplus" value={xp.surplus == null ? '—' : formatXp(xp.surplus)} tone={xp.surplus ? 'good' : 'default'} />
        </div>

        {/* Same 5-column grid and gap as the tiles above, so the card edges line up. */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
          <CostSummary summary={summary} className="lg:col-span-2" />
          <SourceBreakdown summary={summary} className="lg:col-span-3" />
        </div>

        <Card>
          <CardTitle>XP counter by qualification cycle</CardTitle>
          <XpCounterChart series={counter} currentMonth={monthKey(today)} />
        </Card>

        <Card>
          <CardTitle>Monthly</CardTitle>
          <MonthlyTable months={summary.months} counter={counter} currency={summary.reportingCurrency} />
        </Card>
      </div>
    </>
  );
}
