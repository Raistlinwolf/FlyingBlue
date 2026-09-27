'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getConfig, getSupabase } from '@/lib/supabase/client';
import { LoadingSkeleton } from '@/components/data/TrackerProvider';

/**
 * Client-side guard for the signed-in app: without a database connection it opens
 * the Connect screen, without a session the login screen. (Security comes from RLS;
 * this only decides what to show.)
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getConfig()) {
      router.replace('/connect');
      return;
    }
    const supabase = getSupabase();
    const toLogin = () => {
      const next = pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else toLogin();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) toLogin();
    });
    return () => sub.subscription.unsubscribe();
    // Only on mount: navigation inside the app keeps the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready ? children : <LoadingSkeleton />;
}
