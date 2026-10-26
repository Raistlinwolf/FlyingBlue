-- Minimal stand-in for the parts of a Supabase database the migrations rely on,
-- so they can be applied to an embedded Postgres (PGlite) in tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role supabase_auth_admin nologin;

create schema auth;
create schema extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase derives auth.uid() from the request JWT; tests set the claim directly.
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public, auth, extensions to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
