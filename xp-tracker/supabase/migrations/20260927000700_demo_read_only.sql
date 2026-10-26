-- Read-only demo: visitors without an account (role anon) can read the rows of one
-- demo account, chosen by the owner. Nothing is writable for anon. Which account is
-- the demo is data, not code; set it in the SQL editor with
--   update private.app_config set demo_user_id = (select id from auth.users where email = '…');
-- and switch the demo off with `set demo_user_id = null`.
-- Written to be safe to re-run (it was first applied by hand in the SQL editor).

alter table private.app_config
  add column if not exists demo_user_id uuid references auth.users (id) on delete set null;

-- The demo account's id, or null when the demo is off. Security definer because anon
-- cannot read the private schema; it reveals nothing but that id.
create or replace function public.demo_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select demo_user_id from private.app_config where id;
$$;

revoke execute on function public.demo_user_id() from public;
grant execute on function public.demo_user_id() to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_settings',
    'qualification_cycles',
    'bookings',
    'flight_segments',
    'xp_transactions',
    'credits',
    'xp_rules',
    'exchange_rates'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_demo', t);
    execute format(
      'create policy %I on public.%I for select to anon using (user_id = (select public.demo_user_id()))',
      t || '_select_demo', t);
    -- Select only: without insert/update/delete privileges every write by anon fails.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to anon', t);
  end loop;
end;
$$;

-- Airports are public reference data (OpenFlights); the demo needs them for distances.
drop policy if exists airports_read_anon on public.airports;
create policy airports_read_anon on public.airports for select to anon using (true);
revoke all on public.airports from anon;
grant select on public.airports to anon;
