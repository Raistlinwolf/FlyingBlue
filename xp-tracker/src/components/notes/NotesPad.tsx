'use client';
import { useState } from 'react';
import { deleteNote, saveNote, setNotePinned } from '@/lib/store/notes';
import { filterNotes, noteHeading } from '@/domain/notes';
import type { Note } from '@/domain/types';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { PinIcon } from '@/components/ui/icons';
import { Button, EmptyState } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

interface NoteDraft {
  title: string;
  body: string;
  pinned: boolean;
}

const updatedLabel = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** Free-form notes: pinned first, then most recently edited, with a search box. */
export function NotesPad({ notes }: { notes: Note[] }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const shown = filterNotes(notes, query);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="search"
          className="input"
          aria-label="Search notes"
          placeholder="Search notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button variant="primary" className="shrink-0 whitespace-nowrap" onClick={() => setEditing('new')} disabled={editing === 'new'}>
          New note
        </Button>
      </div>

      {editing === 'new' ? <NoteEditor id={null} initial={{ title: '', body: '', pinned: false }} onDone={() => setEditing(null)} /> : null}

      {shown.length === 0 && editing !== 'new' ? (
        <EmptyState title={notes.length ? 'No notes match your search' : 'No notes yet'}>
          {notes.length ? null : 'Jot down routes to try, fare ideas, seat preferences or anything else worth keeping.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((n) =>
            editing === n.id ? (
              <li key={n.id} className="sm:col-span-2 lg:col-span-3">
                <NoteEditor id={n.id} initial={{ title: n.title, body: n.body, pinned: n.pinned }} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={n.id}>
                <NoteCard note={n} onEdit={() => setEditing(n.id)} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function NoteCard({ note, onEdit }: { note: Note; onEdit: () => void }) {
  const { pending, run } = useAction();
  const heading = noteHeading(note);
  // When the heading came from the first line, don't repeat it in the preview.
  const preview = note.title.trim() ? note.body : note.body.replace(/^\s*[^\n]*\n?/, '');

  return (
    <div className="relative flex h-full flex-col rounded-2xl border border-line bg-surface hover:border-accent">
      <button type="button" onClick={onEdit} className="flex flex-1 flex-col gap-1 p-4 pr-11 text-left">
        <span className="break-words font-medium text-ink">{heading}</span>
        {preview.trim() ? <span className="line-clamp-5 whitespace-pre-wrap break-words text-sm text-ink-2">{preview.trim()}</span> : null}
        <span className="mt-auto pt-1 text-xs text-muted">Edited {updatedLabel(note.updated_at)}</span>
      </button>
      <button
        type="button"
        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        aria-pressed={note.pinned}
        disabled={pending}
        onClick={() => run(() => setNotePinned(note.id, !note.pinned))}
        className="absolute right-2 top-2 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink aria-pressed:text-accent disabled:opacity-50"
      >
        <PinIcon width={18} height={18} fill={note.pinned ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

function NoteEditor({ id, initial, onDone }: { id: string | null; initial: NoteDraft; onDone: () => void }) {
  const { pending, run } = useAction();
  const remove = useAction();
  const [d, setD] = useState<NoteDraft>(initial);
  const set = (patch: Partial<NoteDraft>) => setD((x) => ({ ...x, ...patch }));
  const empty = !d.title.trim() && !d.body.trim();

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-accent bg-surface p-3">
      <input
        className="input font-medium"
        aria-label="Title"
        placeholder="Title"
        value={d.title}
        maxLength={200}
        onChange={(e) => set({ title: e.target.value })}
      />
      <textarea
        className="input min-h-48 resize-y leading-relaxed"
        aria-label="Note"
        placeholder="Write anything…"
        value={d.body}
        maxLength={20000}
        autoFocus={id == null}
        onChange={(e) => set({ body: e.target.value })}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 px-1 text-sm text-ink-2">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={d.pinned} onChange={(e) => set({ pinned: e.target.checked })} />
            Pin to top
          </label>
          {id ? (
            <ConfirmButton
              variant="ghost"
              title="Delete this note?"
              message="This cannot be undone."
              confirmLabel="Delete note"
              pending={remove.pending}
              onConfirm={async () => {
                const r = await remove.run(() => deleteNote(id), 'Note deleted');
                if (r.ok) onDone();
              }}
            >
              Delete
            </ConfirmButton>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={pending}
            disabled={empty}
            onClick={async () => {
              const r = await run(() => saveNote(id, d), id ? 'Note saved' : 'Note added');
              if (r.ok) onDone();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
