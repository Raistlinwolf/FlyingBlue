'use client';
import { useSearchParams } from 'next/navigation';
import { useTracker } from '@/components/data/tracker-context';
import { HistoryView } from '@/components/history/HistoryView';
import { PageHeader } from '@/components/ui/primitives';
import { todayIso } from '@/domain/dates';
import { availableYears, sortCyclesNewestFirst } from '@/domain/periods';

export function HistoryScreen() {
  const { data, cycles } = useTracker();
  const params = useSearchParams();
  const tab = params.get('tab');
  return (
    <>
      <PageHeader title="History" subtitle="Everything you have logged. Tap a row to edit." />
      <HistoryView
        data={data}
        cycles={sortCyclesNewestFirst(cycles)}
        years={availableYears(data, todayIso())}
        initialTab={tab === 'flights' || tab === 'xp' || tab === 'credits' ? tab : 'bookings'}
        initialQuery={params.get('q') ?? ''}
      />
    </>
  );
}
