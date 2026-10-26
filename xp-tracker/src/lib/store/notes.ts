// Personal notepad and to-do list.
import { type ActionResult, describeDbError, fail, noRowChanged, ok } from '@/lib/action-result';
import { getSupabase } from '@/lib/supabase/client';
import { type NoteInput, type TodoInput, firstIssue, noteSchema, todoSchema } from '@/lib/validation';

export async function saveNote(id: string | null, input: NoteInput): Promise<ActionResult<{ id: string }>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const { data, error } = id
    ? await supabase.from('notes').update(parsed.data).eq('id', id).select('id')
    : await supabase.from('notes').insert(parsed.data).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  return ok({ id: data![0].id });
}

export async function setNotePinned(id: string, pinned: boolean): Promise<ActionResult> {
  const { data, error } = await getSupabase().from('notes').update({ pinned }).eq('id', id).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  return ok(null);
}

export async function deleteNote(id: string): Promise<ActionResult> {
  const { error } = await getSupabase().from('notes').delete().eq('id', id);
  if (error) return fail(describeDbError(error));
  return ok(null);
}

export async function saveTodo(id: string | null, input: TodoInput): Promise<ActionResult> {
  const parsed = todoSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = getSupabase();
  const { data, error } = id
    ? await supabase.from('todos').update(parsed.data).eq('id', id).select('id')
    : await supabase.from('todos').insert(parsed.data).select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  return ok(null);
}

export async function setTodoDone(id: string, done: boolean): Promise<ActionResult> {
  const { data, error } = await getSupabase()
    .from('todos')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id');
  if (error) return fail(describeDbError(error));
  const missing = noRowChanged(data);
  if (missing) return fail(missing);
  return ok(null);
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  const { error } = await getSupabase().from('todos').delete().eq('id', id);
  if (error) return fail(describeDbError(error));
  return ok(null);
}

/** Removes every completed to-do. */
export async function clearDoneTodos(): Promise<ActionResult<{ deleted: number }>> {
  const { data, error } = await getSupabase().from('todos').delete().not('done_at', 'is', null).select('id');
  if (error) return fail(describeDbError(error));
  return ok({ deleted: data?.length ?? 0 });
}
