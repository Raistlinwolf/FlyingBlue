-- Personal notepad and to-do list. Same security model as the other user-owned tables:
-- each user sees and changes only their own rows; the read-only demo may select the
-- demo account's rows.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_idx on public.notes (user_id, updated_at desc);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  booking_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  notes text check (char_length(notes) <= 2000),
  due_date date,
  -- Null while open; set when ticked off.
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todos_booking_fk foreign key (booking_id, user_id)
    references public.bookings (id, user_id) on delete set null (booking_id)
);

create index todos_user_due_idx on public.todos (user_id, due_date);
create index todos_booking_idx on public.todos (booking_id);

create trigger set_updated_at before update on public.notes
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.todos
  for each row execute function private.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['notes', 'todos']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for select to anon using (user_id = (select public.demo_user_id()))',
      t || '_select_demo', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
