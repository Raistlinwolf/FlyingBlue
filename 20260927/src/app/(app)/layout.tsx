'use client';
import { AuthGate } from '@/components/auth/AuthGate';
import { TrackerProvider } from '@/components/data/TrackerProvider';
import { AppShell } from '@/components/nav/AppShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>
        <TrackerProvider>{children}</TrackerProvider>
      </AppShell>
    </AuthGate>
  );
}
