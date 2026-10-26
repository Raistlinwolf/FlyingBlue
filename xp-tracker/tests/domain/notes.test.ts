import { describe, expect, it } from 'vitest';
import { filterNotes, noteHeading, splitTodos, todoDue } from '@/domain/notes';
import type { Note, Todo } from '@/domain/types';

const todo = (id: string, patch: Partial<Todo> = {}): Todo => ({
  id,
  booking_id: null,
  title: id,
  notes: null,
  due_date: null,
  done_at: null,
  created_at: '2027-01-01T00:00:00Z',
  ...patch,
});

const note = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  title: '',
  body: '',
  pinned: false,
  updated_at: '2027-01-01T00:00:00Z',
  ...patch,
});

describe('to-dos', () => {
  it('classifies due dates relative to today', () => {
    const today = '2027-03-10';
    expect(todoDue(todo('a', { due_date: '2027-03-09' }), today)).toBe('overdue');
    expect(todoDue(todo('a', { due_date: '2027-03-10' }), today)).toBe('today');
    expect(todoDue(todo('a', { due_date: '2027-03-17' }), today)).toBe('soon');
    expect(todoDue(todo('a', { due_date: '2027-03-18' }), today)).toBe('later');
    expect(todoDue(todo('a'), today)).toBe('none');
  });

  it('sorts open to-dos by due date with undated ones last, completed newest first', () => {
    const { open, done } = splitTodos([
      todo('undated-new', { created_at: '2027-02-01T00:00:00Z' }),
      todo('undated-old'),
      todo('later', { due_date: '2027-05-01' }),
      todo('soon', { due_date: '2027-03-01' }),
      todo('done-old', { done_at: '2027-01-02T00:00:00Z' }),
      todo('done-new', { done_at: '2027-02-02T00:00:00Z' }),
    ]);
    expect(open.map((t) => t.id)).toEqual(['soon', 'later', 'undated-old', 'undated-new']);
    expect(done.map((t) => t.id)).toEqual(['done-new', 'done-old']);
  });
});

describe('notes', () => {
  it('lists pinned notes first, then the most recently edited', () => {
    const notes = [
      note('old'),
      note('new', { updated_at: '2027-02-01T00:00:00Z' }),
      note('pinned', { pinned: true }),
    ];
    expect(filterNotes(notes).map((n) => n.id)).toEqual(['pinned', 'new', 'old']);
  });

  it('searches title and body, ignoring case', () => {
    const notes = [note('a', { title: 'Seat map' }), note('b', { body: 'Try AMS–CPH in business' }), note('c', { body: 'other' })];
    expect(filterNotes(notes, 'cph').map((n) => n.id)).toEqual(['b']);
    expect(filterNotes(notes, 'SEAT').map((n) => n.id)).toEqual(['a']);
  });

  it('falls back to the first line of the body as heading', () => {
    expect(noteHeading(note('a', { title: ' XP runs ' }))).toBe('XP runs');
    expect(noteHeading(note('a', { body: '\n  Fare ideas \nTPE' }))).toBe('Fare ideas');
    expect(noteHeading(note('a'))).toBe('Untitled note');
  });
});
