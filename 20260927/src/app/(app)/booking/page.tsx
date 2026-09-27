import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingScreen } from '@/components/screens/RecordScreens';

export const metadata: Metadata = { title: 'Booking' };

export default function Page() {
  return (
    <Suspense>
      <BookingScreen />
    </Suspense>
  );
}
