'use client';
import { z } from 'zod';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { getSupabase } from '@/lib/supabase/client';

const credentials = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export async function signIn(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { error } = await getSupabase().auth.signInWithPassword(parsed.data);
  if (error) return fail(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
  return ok(null);
}

export async function signUp(input: { email: string; password: string }): Promise<ActionResult<{ signedIn: boolean }>> {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const redirect = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/auth/confirm/`;
  const { data, error } = await getSupabase().auth.signUp({ ...parsed.data, options: { emailRedirectTo: redirect } });
  if (error) {
    // The allowlist trigger surfaces as a database error from the auth service.
    if (/SIGNUP_NOT_ALLOWED|database error/i.test(error.message)) {
      return fail('Registration is restricted. Add your email to private.signup_allowlist first.');
    }
    return fail(error.message);
  }
  return ok({ signedIn: Boolean(data.session) });
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

/** Changes the signed-in user's password after re-checking the current one. */
export async function changePassword(input: { email: string; current: string; next: string; confirm: string }): Promise<ActionResult> {
  if (input.next.length < 8) return fail('The new password needs at least 8 characters.');
  if (input.next !== input.confirm) return fail('The new passwords do not match.');
  if (input.next === input.current) return fail('The new password is the same as the current one.');
  const supabase = getSupabase();
  const check = await supabase.auth.signInWithPassword({ email: input.email, password: input.current });
  if (check.error) return fail('The current password is not correct.');
  const { error } = await supabase.auth.updateUser({ password: input.next });
  if (error) return fail(error.message);
  return ok(null);
}
