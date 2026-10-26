'use client';
import type { EmailOtpType } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Email confirmation landing page. Supabase can come back with ?token_hash=&type=,
 * ?code= (PKCE) or a session in the URL hash (implicit flow); the client picks up the
 * hash form by itself while initialising.
 */
export default function ConfirmPage() {
  const router = useRouter();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;
    const code = params.get('code');
    const supabase = getSupabase();
    const hashError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');

    const verify = async () => {
      if (hashError) return false;
      if (tokenHash && type) return !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
      if (code) return !(await supabase.auth.exchangeCodeForSession(code)).error;
      const { data } = await supabase.auth.getSession(); // waits for the hash to be processed
      return Boolean(data.session);
    };
    verify().then((ok) => router.replace(ok ? '/dashboard' : '/login?error=confirmation'));
  }, [router]);
  return <p className="p-6 text-center text-sm text-ink-2">Confirming your email…</p>;
}
