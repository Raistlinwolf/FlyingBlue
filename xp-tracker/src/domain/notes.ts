// Ordering and grouping for the notepad and to-do list.
import { addDays } from './dates';
import type { IsoDate, Note, Todo } from './types';

export type TodoDue = 'overdue' | 'today' | 'soon' | 'later' | 'none';

/** How urgent an open to-do is; "soon" means within the next seven days. */
export function todoDue(todo: Todo, today: IsoDate): TodoDue {
  if (!todo.due_date) return 'none';
  if (todo.due_date < today) return 'overdue';
  if (todo.due_date === today) return 'today';
  return todo.due_date <= addDays(today, 7) ? 'soon' : 'later';
}

/**
 * Open to-dos by due date (undated last, oldest first among them); completed ones
 * most recently ticked off first.
 */
export function splitTodos(todos: Todo[]): { open: Todo[]; done: Todo[] } {
  const created = (t: Todo) => t.created_at ?? '';
  const open = todos
    .filter((t) => !t.done_at)
    .sort((a, b) => {
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date < b.due_date ? -1 : 1;
      }
      return created(a).localeCompare(created(b));
    });
  const done = todos.filter((t) => t.done_at).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
  return { open, done };
}

/** Pinned notes first, then most recently edited; `query` matches title or body. */
export function filterNotes(notes: Note[], query = ''): Note[] {
  const q = query.trim().toLowerCase();
  return notes
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
    });
}

/** A note's display title: its title, else its first non-empty line. */
export function noteHeading(note: Note): string {
  return note.title.trim() || note.body.split('\n').find((l) => l.trim())?.trim() || 'Untitled note';
}
