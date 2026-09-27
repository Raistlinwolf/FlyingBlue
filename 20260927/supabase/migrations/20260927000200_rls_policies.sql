-- Row Level Security: users can only see and change their own rows.
-- `(select auth.uid())` is evaluated once per statement instead of once per row.

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

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Airports: global reference data, read-only for signed-in users.
alter table public.airports enable row level security;

create policy airports_read on public.airports
  for select to authenticated using (true);

revoke all on public.airports from anon;
grant select on public.airports to authenticated;
