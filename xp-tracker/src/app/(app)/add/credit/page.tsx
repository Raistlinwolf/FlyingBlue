import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AddCreditScreen } from '@/components/screens/AddScreens';

export const metadata: Metadata = { title: 'Add credit' };

export default function Page() {
  return (
    <Suspense>
      <AddCreditScreen />
    </Suspense>
  );
}
