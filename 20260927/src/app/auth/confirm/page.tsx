'use client';
import type { EmailOtpType } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';

/** Email confirmation landing page: exchanges the token in the URL for a session. */
export default function ConfirmPage() {
  const router = useRouter();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;
    const code = params.get('code');
    const supabase = getSupabase();
    const verify = tokenHash && type
      ? supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : code
        ? supabase.auth.exchangeCodeForSession(code)
        : Promise.resolve({ error: new Error('missing token') });
    verify.then(({ error }) => router.replace(error ? '/login?error=confirmation' : '/dashboard'));
  }, [router]);
  return <p className="p-6 text-center text-sm text-ink-2">Confirming your email…</p>;
}
