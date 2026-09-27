export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Row Level Security makes an update of a row you cannot see succeed with zero rows,
 * so single-row updates ask for the changed id back and treat "none" as a failure.
 */
export function noRowChanged(data: unknown[] | null): string | null {
  return data && data.length > 0 ? null : 'Nothing was saved: the record was not found. Reload the page and try again.';
}

/** Turns Postgres/PostgREST errors into messages a person can act on. */
export function describeDbError(error: { code?: string; message: string }): string {
  if (error.code === '23P01') return 'This qualification cycle overlaps an existing one.';
  if (error.code === '23505') return 'A record with the same values already exists.';
  if (error.code === '23503') return 'The linked booking no longer exists.';
  if (error.code === '23514') return `A value is out of range (${error.message}).`;
  if (error.code === '42501') return 'You are not allowed to change this record.';
  return error.message;
}
