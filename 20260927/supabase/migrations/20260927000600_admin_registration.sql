-- Admins, an in-app registration switch and allowlist management, plus a keep-alive
-- probe. Admin accounts are data, not code: add them with
--   insert into private.admins (user_id) select id from auth.users where email = '…';
-- (never in a migration, which lives in the public repository).

create table private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Single-row application configuration.
create table private.app_config (
  id boolean primary key default true check (id),
  registration_open boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.app_config (id) values (true);

-- Registration: allowed while the switch is on, or for allow-listed emails.
create or replace function private.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select registration_open from private.app_config where id) then
    return new;
  end if;
  if not exists (
    select 1 from private.signup_allowlist a where a.email = lower(new.email)
  ) then
    raise exception 'SIGNUP_NOT_ALLOWED: % is not on the signup allowlist', new.email
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- --- Admin API (callable by signed-in users; every function checks is_admin) --------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admins where user_id = auth.uid());
$$;

create or replace function private.require_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.admins where user_id = auth.uid()) then
    raise exception 'Only an admin can do this.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_registration_status()
returns table (registration_open boolean, allowlist text[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select c.registration_open,
           coalesce((select array_agg(a.email order by a.email) from private.signup_allowlist a), '{}')
    from private.app_config c where c.id;
end;
$$;

create or replace function public.admin_set_registration_open(open boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update private.app_config set registration_open = open, updated_at = now() where id;
  return open;
end;
$$;

create or replace function public.admin_allow_email(target_email text, allow boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if target_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if allow then
    insert into private.signup_allowlist (email) values (lower(target_email)) on conflict do nothing;
  else
    delete from private.signup_allowlist a where a.email = lower(target_email);
  end if;
end;
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_registration_status() from public, anon;
revoke execute on function public.admin_set_registration_open(boolean) from public, anon;
revoke execute on function public.admin_allow_email(text, boolean) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_registration_status() to authenticated;
grant execute on function public.admin_set_registration_open(boolean) to authenticated;
grant execute on function public.admin_allow_email(text, boolean) to authenticated;

-- --- Keep-alive ------------------------------------------------------------------
-- A scheduled GitHub Action calls this so a free Supabase project is never paused for
-- inactivity. It touches the database but reads or writes no user data.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

grant execute on function public.keepalive() to anon, authenticated;
