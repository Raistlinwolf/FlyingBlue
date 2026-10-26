'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTracker } from '@/components/data/tracker-context';
import { NotesPad } from '@/components/notes/NotesPad';
import { TodoList } from '@/components/notes/TodoList';
import { Notice, PageHeader } from '@/components/ui/primitives';
import { todayIso } from '@/domain/dates';
import { splitTodos, todoDue } from '@/domain/notes';

type Tab = 'todos' | 'notes';

export function NotesScreen() {
  const { notes, todos, notesAvailable, entry } = useTracker();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'notes' ? 'notes' : 'todos');
  const today = todayIso();
  const { open } = splitTodos(todos);
  const overdue = open.filter((t) => todoDue(t, today) === 'overdue').length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'todos', label: 'To-do', count: open.length },
    { key: 'notes', label: 'Notes', count: notes.length },
  ];

  return (
    <>
      <PageHeader
        title="Notes & to-dos"
        subtitle={`${open.length} open to-do${open.length === 1 ? '' : 's'}${overdue ? ` · ${overdue} overdue` : ''} · ${notes.length} note${notes.length === 1 ? '' : 's'}`}
      />
      {notesAvailable ? null : (
        <div className="mb-3">
          <Notice>
            This database does not have notes and to-dos yet. Run the migration <code>20261026000100_notes_todos.sql</code> in the Supabase SQL
            editor (or <code>supabase db push</code>), then reload.
          </Notice>
        </div>
      )}
      <div role="tablist" className="mb-3 flex gap-1 rounded-xl bg-surface-2 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              window.history.replaceState(null, '', `?tab=${t.key}`);
            }}
            className="min-h-9 flex-1 rounded-lg text-sm font-medium text-ink-2 aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-sm"
          >
            {t.label} <span className="text-xs text-muted tabular">{t.count}</span>
          </button>
        ))}
      </div>
      {tab === 'todos' ? <TodoList todos={todos} bookings={entry.bookings} today={today} /> : <NotesPad notes={notes} />}
    </>
  );
}
