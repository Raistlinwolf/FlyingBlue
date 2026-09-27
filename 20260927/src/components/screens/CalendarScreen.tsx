'use client';
import { useSearchParams } from 'next/navigation';
import { CalendarView } from '@/components/calendar/CalendarView';
import { useTracker } from '@/components/data/tracker-context';
import { PageHeader } from '@/components/ui/primitives';
import { calendarDays, monthGrid } from '@/domain/calendar';
import { addMonths, formatMonthLabel, monthKey, todayIso } from '@/domain/dates';

export function CalendarScreen() {
  const { data } = useTracker();
  const params = useSearchParams();
  const today = todayIso();
  const monthParam = params.get('month');
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : monthKey(today);
  const days = Object.fromEntries(calendarDays(data, month));
  const totals = Object.values(days).reduce(
    (acc, d) => ({ flights: acc.flights + d.flights, actual: acc.actual + d.actualXp, booked: acc.booked + d.bookedXp }),
    { flights: 0, actual: 0, booked: 0 },
  );

  return (
    <>
      <PageHeader
        title={formatMonthLabel(month)}
        subtitle={`${totals.flights} flight${totals.flights === 1 ? '' : 's'} · ${totals.actual} XP earned${totals.booked ? ` · +${totals.booked} booked` : ''}`}
      />
      <CalendarView
        month={month}
        prevMonth={addMonths(month, -1)}
        nextMonth={addMonths(month, 1)}
        thisMonth={monthKey(today)}
        today={today}
        weeks={monthGrid(month)}
        days={days}
      />
    </>
  );
}
