import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AddFlightScreen } from '@/components/screens/AddScreens';

export const metadata: Metadata = { title: 'Add flight' };

export default function Page() {
  return (
    <Suspense>
      <AddFlightScreen />
    </Suspense>
  );
}
