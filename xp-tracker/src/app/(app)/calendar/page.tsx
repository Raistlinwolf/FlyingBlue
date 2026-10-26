import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalendarScreen } from '@/components/screens/CalendarScreen';

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return (
    <Suspense>
      <CalendarScreen />
    </Suspense>
  );
}
