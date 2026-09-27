import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CreditScreen } from '@/components/screens/RecordScreens';

export const metadata: Metadata = { title: 'Edit credit' };

export default function Page() {
  return (
    <Suspense>
      <CreditScreen />
    </Suspense>
  );
}
