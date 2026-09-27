-- Registration allowlist, per-user defaults and the default Flying Blue XP chart.

-- ---------------------------------------------------------------------------
-- Signup allowlist
-- The private schema is not exposed through the Data API, so clients cannot read
-- or modify this table. Add your email with:
--   insert into private.signup_allowlist (email) values ('you@example.com');
-- ---------------------------------------------------------------------------

create table private.signup_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function private.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.signup_allowlist a where a.email = lower(new.email)
  ) then
    raise exception 'SIGNUP_NOT_ALLOWED: % is not on the signup allowlist', new.email
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function private.enforce_signup_allowlist();

-- ---------------------------------------------------------------------------
-- Default XP chart (Flying Blue revenue tickets, per segment).
-- These are editable per user in Settings → XP rules. Verify against the current
-- chart on flyingblue.com; add a new rule set with a later effective_from when
-- Flying Blue changes it instead of editing historical rules.
-- ---------------------------------------------------------------------------

create or replace function private.install_default_xp_rules(target_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.xp_rules
    (user_id, effective_from, route_category, is_domestic, min_distance_miles, max_distance_miles, cabin, xp, notes)
  select target_user, date '2018-04-01', r.category, r.domestic, r.min_miles, r.max_miles, c.cabin, c.xp,
         'Default Flying Blue chart'
  from (values
    ('Domestic', true,  null::integer, null::integer, 2,  4,  6,  10),
    ('Medium',   false, 0,             2000,          5,  10, 15, 25),
    ('Long 1',   false, 2000,          3500,          8,  16, 24, 40),
    ('Long 2',   false, 3500,          5000,          10, 20, 30, 50),
    ('Long 3',   false, 5000,          null,          12, 24, 36, 60)
  ) as r(category, domestic, min_miles, max_miles, economy, premium, business, first)
  cross join lateral (values
    ('Economy', r.economy),
    ('Premium Economy', r.premium),
    ('Business', r.business),
    ('First', r.first)
  ) as c(cabin, xp);

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- Callable from the app (Settings → XP rules). Only ever touches the caller's rows.
create or replace function public.install_default_xp_rules(replace_existing boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if replace_existing then
    delete from public.xp_rules where user_id = uid;
  elsif exists (select 1 from public.xp_rules where user_id = uid) then
    return 0;
  end if;

  return private.install_default_xp_rules(uid);
end;
$$;

revoke execute on function public.install_default_xp_rules(boolean) from public, anon;
grant execute on function public.install_default_xp_rules(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- New users get a settings row and the default XP chart.
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  if not exists (select 1 from public.xp_rules where user_id = new.id) then
    perform private.install_default_xp_rules(new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- The auth service inserts users as supabase_auth_admin.
grant usage on schema private to supabase_auth_admin;
grant execute on function private.enforce_signup_allowlist() to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;

-- Backfill accounts that existed before this migration.
insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

select private.install_default_xp_rules(u.id)
from auth.users u
where not exists (select 1 from public.xp_rules r where r.user_id = u.id);
