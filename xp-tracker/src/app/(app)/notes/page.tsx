import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotesScreen } from '@/components/screens/NotesScreen';

export const metadata: Metadata = { title: 'Notes & to-dos' };

export default function Page() {
  return (
    <Suspense>
      <NotesScreen />
    </Suspense>
  );
}
