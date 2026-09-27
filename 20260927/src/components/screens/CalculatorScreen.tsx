'use client';
import { CalculatorView } from '@/components/calculator/CalculatorView';
import { useTracker } from '@/components/data/tracker-context';
import { PageHeader } from '@/components/ui/primitives';
import { todayIso } from '@/domain/dates';

export function CalculatorScreen() {
  const { settings, rules, entry } = useTracker();
  return (
    <>
      <PageHeader title="XP calculator" subtitle="Estimates from your XP rules — credited XP is recorded separately." />
      <CalculatorView
        rules={rules}
        today={todayIso()}
        homeAirport={settings.home_airport}
        defaultCabin={settings.default_cabin}
        defaultAirline={settings.default_airline}
        recentAirports={entry.recentAirports}
        recentAirlines={entry.recentAirlines}
      />
    </>
  );
}
