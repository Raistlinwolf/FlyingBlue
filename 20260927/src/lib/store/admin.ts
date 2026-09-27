'use client';
// Admin-only registration controls. The database checks admin rights in every call.
import { type ActionResult, describeDbError, fail, ok } from '@/lib/action-result';
import { getSupabase } from '@/lib/supabase/client';

export interface RegistrationStatus {
  registrationOpen: boolean;
  allowlist: string[];
}

export async function loadIsAdmin(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_admin');
  return !error && data === true; // older databases without the function: not admin
}

export async function loadRegistrationStatus(): Promise<ActionResult<RegistrationStatus>> {
  const { data, error } = await getSupabase().rpc('admin_registration_status');
  if (error) return fail(describeDbError(error));
  const row = (Array.isArray(data) ? data[0] : data) as { registration_open: boolean; allowlist: string[] } | undefined;
  return ok({ registrationOpen: Boolean(row?.registration_open), allowlist: row?.allowlist ?? [] });
}

export async function setRegistrationOpen(open: boolean): Promise<ActionResult> {
  const { error } = await getSupabase().rpc('admin_set_registration_open', { open });
  return error ? fail(describeDbError(error)) : ok(null);
}

export async function setEmailAllowed(email: string, allow: boolean): Promise<ActionResult> {
  const { error } = await getSupabase().rpc('admin_allow_email', { target_email: email.trim(), allow });
  return error ? fail(describeDbError(error)) : ok(null);
}
