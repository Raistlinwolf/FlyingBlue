import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AddXpScreen } from '@/components/screens/AddScreens';

export const metadata: Metadata = { title: 'Add XP' };

export default function Page() {
  return (
    <Suspense>
      <AddXpScreen />
    </Suspense>
  );
}
