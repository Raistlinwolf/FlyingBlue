-- Local development only (runs on `supabase db reset`, never on the hosted project).
-- Allows registering a local test account.
insert into private.signup_allowlist (email) values ('dev@example.com') on conflict do nothing;
