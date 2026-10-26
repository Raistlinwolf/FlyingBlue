import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardScreen } from '@/components/screens/DashboardScreen';

export const metadata: Metadata = { title: 'Dashboard' };

export default function Page() {
  return (
    <Suspense>
      <DashboardScreen />
    </Suspense>
  );
}
