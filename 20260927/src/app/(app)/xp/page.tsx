import type { Metadata } from 'next';
import { Suspense } from 'react';
import { XpScreen } from '@/components/screens/RecordScreens';

export const metadata: Metadata = { title: 'Edit XP' };

export default function Page() {
  return (
    <Suspense>
      <XpScreen />
    </Suspense>
  );
}
