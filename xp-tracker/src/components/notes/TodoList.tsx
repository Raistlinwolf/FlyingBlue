'use client';
import Link from 'next/link';
import { useState } from 'react';
import { clearDoneTodos, deleteTodo, saveTodo, setTodoDone } from '@/lib/store/notes';
import { formatDate } from '@/domain/dates';
import { type TodoDue, splitTodos, todoDue } from '@/domain/notes';
import type { Todo } from '@/domain/types';
import type { BookingChoice } from '@/components/forms/XpTransactionForm';
import { Select } from '@/components/forms/inputs';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Button, Card, EmptyState, Field } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

interface TodoDraft {
  title: string;
  notes: string;
  due_date: string;
  booking_id: string;
}

const emptyDraft = (bookingId = ''): TodoDraft => ({ title: '', notes: '', due_date: '', booking_id: bookingId });

const dueStyles: Record<TodoDue, string> = {
  overdue: 'text-danger font-medium',
  today: 'text-warning-ink font-medium',
  soon: 'text-accent-ink',
  later: 'text-muted',
  none: 'text-muted',
};

/**
 * Open to-dos sorted by due date, with a quick-add row on top. Completed ones collapse
 * into a section below and can be reopened or cleared.
 */
export function TodoList({
  todos,
  bookings,
  today,
  bookingId,
}: {
  todos: Todo[];
  bookings: BookingChoice[];
  today: string;
  /** When set, the list shows only this booking's to-dos and new ones are linked to it. */
  bookingId?: string;
}) {
  const { open, done } = splitTodos(bookingId ? todos.filter((t) => t.booking_id === bookingId) : todos);
  const bookingNames = new Map(bookings.map((b) => [b.id, b.booking_name]));
  const [editing, setEditing] = useState<string | null>(null);
  const clear = useAction();

  return (
    <div className="flex flex-col gap-3">
      {bookingId ? (
        <TodoEditor id={null} initial={emptyDraft(bookingId)} bookings={bookings} compact hideBooking />
      ) : (
        <Card className="p-3 sm:p-3">
          <TodoEditor id={null} initial={emptyDraft()} bookings={bookings} compact />
        </Card>
      )}

      {open.length === 0 ? (
        <EmptyState title={done.length ? 'All done' : 'Nothing to do yet'}>
          {bookingId ? 'Add reminders for this trip, e.g. “Request SAF XP” or “Claim EC261”.' : 'Add reminders like “Book seat”, “Check XP credited” or “Claim compensation”.'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {open.map((t) =>
            editing === t.id ? (
              <li key={t.id} className="p-3">
                <TodoEditor
                  id={t.id}
                  initial={{ title: t.title, notes: t.notes ?? '', due_date: t.due_date ?? '', booking_id: t.booking_id ?? '' }}
                  bookings={bookings}
                  hideBooking={Boolean(bookingId)}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <TodoRow
                key={t.id}
                todo={t}
                today={today}
                bookingName={bookingId ? null : t.booking_id ? (bookingNames.get(t.booking_id) ?? null) : null}
                onEdit={() => setEditing(t.id)}
              />
            ),
          )}
        </ul>
      )}

      {done.length > 0 ? (
        <details className="group rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium text-ink-2">
            <span>
              Completed <span className="text-xs text-muted tabular">{done.length}</span>
            </span>
            <span className="text-xs text-muted group-open:hidden">Show</span>
            <span className="hidden text-xs text-muted group-open:inline">Hide</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {done.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                today={today}
                bookingName={bookingId ? null : t.booking_id ? (bookingNames.get(t.booking_id) ?? null) : null}
              />
            ))}
          </ul>
          {bookingId ? null : (
            <div className="flex justify-end border-t border-line p-2">
              <ConfirmButton
                variant="ghost"
                title={`Delete ${done.length} completed to-do${done.length === 1 ? '' : 's'}?`}
                message="Open to-dos are not affected. This cannot be undone."
                confirmLabel="Delete completed"
                pending={clear.pending}
                onConfirm={() => clear.run(() => clearDoneTodos(), 'Completed to-dos cleared')}
              >
                Clear completed
              </ConfirmButton>
            </div>
          )}
        </details>
      ) : null}
    </div>
  );
}

function TodoRow({
  todo,
  today,
  bookingName,
  onEdit,
}: {
  todo: Todo;
  today: string;
  bookingName: string | null;
  onEdit?: () => void;
}) {
  const { pending, run } = useAction();
  const remove = useAction();
  // Show the tick straight away; the row moves to its section once the reload lands.
  const [ticked, setTicked] = useState<boolean | null>(null);
  const isDone = ticked ?? Boolean(todo.done_at);
  const due = todoDue(todo, today);

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--accent)] disabled:opacity-50"
        aria-label={todo.done_at ? `Reopen “${todo.title}”` : `Mark “${todo.title}” done`}
        checked={isDone}
        disabled={pending}
        onChange={async (e) => {
          const done = e.target.checked;
          setTicked(done);
          const r = await run(() => setTodoDone(todo.id, done));
          if (!r.ok) setTicked(null);
        }}
      />
      <div className="min-w-0 flex-1">
        <p className={`break-words text-sm ${isDone ? 'text-muted line-through' : 'font-medium text-ink'}`}>{todo.title}</p>
        {todo.notes ? <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-ink-2">{todo.notes}</p> : null}
        {todo.due_date || bookingName ? (
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
            {todo.due_date ? (
              <span className={isDone ? 'text-muted' : dueStyles[due]}>
                {due === 'overdue' && !isDone ? 'Overdue · ' : due === 'today' && !isDone ? 'Today · ' : ''}
                {formatDate(todo.due_date)}
              </span>
            ) : null}
            {bookingName && todo.booking_id ? (
              <Link href={`/booking?id=${todo.booking_id}`} className="text-accent-ink underline-offset-2 hover:underline">
                {bookingName}
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>
      {onEdit ? (
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
      ) : (
        <Button size="sm" variant="ghost" pending={remove.pending} onClick={() => remove.run(() => deleteTodo(todo.id), 'To-do deleted')}>
          Delete
        </Button>
      )}
    </li>
  );
}

function TodoEditor({
  id,
  initial,
  bookings,
  compact,
  hideBooking,
  onDone,
}: {
  id: string | null;
  initial: TodoDraft;
  bookings: BookingChoice[];
  /** The quick-add row: title on its own, details behind a toggle. */
  compact?: boolean;
  hideBooking?: boolean;
  onDone?: () => void;
}) {
  const { pending, run } = useAction();
  const remove = useAction();
  const [d, setD] = useState<TodoDraft>(initial);
  const [details, setDetails] = useState(!compact);
  const set = (patch: Partial<TodoDraft>) => setD((x) => ({ ...x, ...patch }));

  const submit = async () => {
    const r = await run(
      () => saveTodo(id, { ...d, notes: d.notes || null, booking_id: d.booking_id || null }),
      id ? 'To-do updated' : 'To-do added',
    );
    if (!r.ok) return;
    if (id) onDone?.();
    else setD(emptyDraft(initial.booking_id));
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex gap-2">
        <input
          className="input"
          aria-label="To-do"
          placeholder={id ? undefined : 'Add a to-do…'}
          value={d.title}
          maxLength={300}
          onChange={(e) => set({ title: e.target.value })}
        />
        {compact ? (
          <Button type="submit" variant="primary" pending={pending} disabled={!d.title.trim()}>
            Add
          </Button>
        ) : null}
      </div>
      {compact && !details ? (
        <button type="button" className="self-start text-xs text-ink-2 underline-offset-2 hover:underline" onClick={() => setDetails(true)}>
          + due date{hideBooking ? '' : ', booking'} or note
        </button>
      ) : null}
      {details ? (
        <>
          <div className={`grid gap-2 ${hideBooking ? '' : 'sm:grid-cols-2'}`}>
            <Field label="Due date (optional)">
              <input type="date" className="input" value={d.due_date} onChange={(e) => set({ due_date: e.target.value })} />
            </Field>
            {hideBooking ? null : (
              <Field label="Linked booking (optional)">
                <Select
                  label="Linked booking"
                  value={d.booking_id}
                  options={[{ value: '', label: '— none —' }, ...bookings.map((b) => ({ value: b.id, label: b.booking_name }))]}
                  onChange={(v) => set({ booking_id: v })}
                />
              </Field>
            )}
          </div>
          <Field label="Note (optional)">
            <input className="input" value={d.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </>
      ) : null}
      {id ? (
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" pending={remove.pending} onClick={() => remove.run(() => deleteTodo(id), 'To-do deleted')}>
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" pending={pending} disabled={!d.title.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
