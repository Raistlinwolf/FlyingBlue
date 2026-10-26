import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AddBookingScreen } from '@/components/screens/AddScreens';

export const metadata: Metadata = { title: 'Add booking' };

export default function Page() {
  return (
    <Suspense>
      <AddBookingScreen />
    </Suspense>
  );
}
