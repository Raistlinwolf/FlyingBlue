import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalculatorScreen } from '@/components/screens/CalculatorScreen';

export const metadata: Metadata = { title: 'XP calculator' };

export default function Page() {
  return (
    <Suspense>
      <CalculatorScreen />
    </Suspense>
  );
}
