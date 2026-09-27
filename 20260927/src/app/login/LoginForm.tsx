'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { safeNext, signIn, signUp } from '@/lib/store/auth';
import { useConfig } from '@/lib/supabase/client';
import { Button, Card, Field, Notice } from '@/components/ui/primitives';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'confirmation' ? 'The confirmation link is invalid or has expired.' : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const config = useConfig();
  const database = config?.url ?? null;

  useEffect(() => {
    if (config === null) router.replace('/connect');
  }, [config, router]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    setError(null);
    setInfo(null);
    startTransition(async () => {
      if (mode === 'signin') {
        const result = await signIn({ email, password });
        if (result.ok) router.replace(next);
        else setError(result.error);
        return;
      }
      const result = await signUp({ email, password });
      if (!result.ok) setError(result.error);
      else if (result.data.signedIn) router.replace('/dashboard');
      else setInfo('Check your inbox to confirm your email, then sign in.');
    });
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email">
          <input className="input" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
          <input
            className="input"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {info ? <Notice tone="info">{info}</Notice> : null}
        <Button type="submit" variant="primary" size="lg" pending={pending}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-2">
        {mode === 'signin' ? 'First time here?' : 'Already registered?'}{' '}
        <button
          type="button"
          className="font-medium text-accent-ink underline-offset-2 hover:underline"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setInfo(null);
          }}
        >
          {mode === 'signin' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
      {database ? (
        <p className="mt-3 border-t border-line pt-3 text-center text-xs text-muted">
          Database: <span className="font-mono">{database}</span> ·{' '}
          <Link href="/connect" className="underline">
            change
          </Link>
        </p>
      ) : null}
    </Card>
  );
}
