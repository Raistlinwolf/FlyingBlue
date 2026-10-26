import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FlightScreen } from '@/components/screens/RecordScreens';

export const metadata: Metadata = { title: 'Edit flight' };

export default function Page() {
  return (
    <Suspense>
      <FlightScreen />
    </Suspense>
  );
}
