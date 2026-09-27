import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HistoryScreen } from '@/components/screens/HistoryScreen';

export const metadata: Metadata = { title: 'History' };

export default function Page() {
  return (
    <Suspense>
      <HistoryScreen />
    </Suspense>
  );
}
