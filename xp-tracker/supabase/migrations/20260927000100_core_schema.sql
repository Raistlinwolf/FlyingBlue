-- Flying Blue XP Tracker: core schema
-- Every user-owned table carries user_id (default auth.uid()) and is protected by RLS
-- (see 20260927000200_rls_policies.sql).

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  preferred_currency text not null default 'EUR' check (preferred_currency ~ '^[A-Z]{3}$'),
  home_airport text check (home_airport ~ '^[A-Z]{3}$'),
  default_airline text check (char_length(default_airline) <= 40),
  default_cabin text not null default 'Economy'
    check (default_cabin in ('Economy', 'Premium Economy', 'Business', 'First')),
  default_category text not null default 'XP Run'
    check (default_category in ('XP Run', 'Personal Travel', 'Business Travel', 'Positioning', 'Award Travel', 'Other')),
  current_status text not null default 'Explorer'
    check (current_status in ('Explorer', 'Silver', 'Gold', 'Platinum', 'Ultimate')),
  xp_target integer not null default 300 check (xp_target >= 0),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- qualification_cycles
-- ---------------------------------------------------------------------------

create table public.qualification_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  start_date date not null,
  end_date date not null,
  starting_status text not null default 'Explorer'
    check (starting_status in ('Explorer', 'Silver', 'Gold', 'Platinum', 'Ultimate')),
  target_xp integer not null default 300 check (target_xp >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qualification_cycles_dates_valid check (end_date >= start_date),
  -- A date belongs to at most one cycle per user.
  constraint qualification_cycles_no_overlap exclude using gist (
    user_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

create index qualification_cycles_user_start_idx on public.qualification_cycles (user_id, start_date);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  booking_reference text check (char_length(booking_reference) <= 20),
  ticket_number text check (char_length(ticket_number) <= 30),
  booking_name text not null check (char_length(booking_name) between 1 and 120),
  purchase_date date not null default current_date,
  category text not null default 'XP Run'
    check (category in ('XP Run', 'Personal Travel', 'Business Travel', 'Positioning', 'Award Travel', 'Other')),
  total_price numeric(12, 2) not null default 0 check (total_price >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  baseline_alternative_price numeric(12, 2) check (baseline_alternative_price >= 0),
  notes text,
  status text not null default 'Booked' check (status in ('Planned', 'Booked', 'Flown', 'Cancelled')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for composite foreign keys so child rows can only reference the owner's bookings.
  constraint bookings_id_user_unique unique (id, user_id)
);

create index bookings_user_purchase_idx on public.bookings (user_id, purchase_date);

-- ---------------------------------------------------------------------------
-- flight_segments
-- ---------------------------------------------------------------------------

create table public.flight_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  booking_id uuid not null,
  position smallint not null default 0,
  flight_date date not null,
  flight_number text check (char_length(flight_number) <= 10),
  origin_iata text not null check (origin_iata ~ '^[A-Z]{3}$'),
  destination_iata text not null check (destination_iata ~ '^[A-Z]{3}$'),
  marketing_airline text not null check (char_length(marketing_airline) between 1 and 40),
  operating_airline text check (char_length(operating_airline) <= 40),
  cabin text not null default 'Economy' check (cabin in ('Economy', 'Premium Economy', 'Business', 'First')),
  fare_class text check (char_length(fare_class) <= 2),
  expected_xp integer not null default 0 check (expected_xp >= 0),
  actual_xp integer check (actual_xp >= 0),
  segment_status text not null default 'Booked'
    check (segment_status in ('Planned', 'Booked', 'Flown', 'Cancelled')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flight_segments_route_valid check (origin_iata <> destination_iata),
  constraint flight_segments_booking_fk foreign key (booking_id, user_id)
    references public.bookings (id, user_id) on delete cascade
);

create index flight_segments_booking_idx on public.flight_segments (booking_id, position);
create index flight_segments_user_date_idx on public.flight_segments (user_id, flight_date);

-- ---------------------------------------------------------------------------
-- xp_transactions (non-flight XP)
-- ---------------------------------------------------------------------------

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  booking_id uuid,
  transaction_date date not null default current_date,
  source_type text not null
    check (source_type in ('SAF', 'Credit Card', 'Promotion', 'Choice Benefit', 'Partner', 'Adjustment', 'Other')),
  description text check (char_length(description) <= 200),
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  expected_xp integer not null default 0,
  actual_xp integer,
  status text not null default 'Credited' check (status in ('Planned', 'Pending', 'Credited', 'Cancelled')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- MATCH SIMPLE: a null booking_id is simply "not linked".
  constraint xp_transactions_booking_fk foreign key (booking_id, user_id)
    references public.bookings (id, user_id) on delete set null (booking_id)
);

create index xp_transactions_user_date_idx on public.xp_transactions (user_id, transaction_date);
create index xp_transactions_booking_idx on public.xp_transactions (booking_id);

-- ---------------------------------------------------------------------------
-- credits (money received back)
-- ---------------------------------------------------------------------------

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  booking_id uuid,
  transaction_date date not null default current_date,
  credit_type text not null
    check (credit_type in ('Ticket Refund', 'Airline Compensation', 'EC261 Compensation', 'Expense Reimbursement', 'Statement Credit', 'Voucher', 'Other')),
  description text check (char_length(description) <= 200),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  include_in_net_cost boolean not null default true,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credits_booking_fk foreign key (booking_id, user_id)
    references public.bookings (id, user_id) on delete set null (booking_id)
);

create index credits_user_date_idx on public.credits (user_id, transaction_date);
create index credits_booking_idx on public.credits (booking_id);

-- ---------------------------------------------------------------------------
-- airports (global reference data, seeded by a later migration)
-- ---------------------------------------------------------------------------

create table public.airports (
  iata text primary key check (iata ~ '^[A-Z]{3}$'),
  name text not null,
  city text,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180)
);

create index airports_city_idx on public.airports (lower(city));

-- ---------------------------------------------------------------------------
-- xp_rules (configurable XP chart)
-- ---------------------------------------------------------------------------

create table public.xp_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from date not null,
  effective_to date,
  route_category text not null check (char_length(route_category) between 1 and 40),
  -- Band definition for the route category: a domestic rule applies to flights within
  -- one country; otherwise the great-circle distance must fall in [min, max).
  is_domestic boolean not null default false,
  min_distance_miles integer check (min_distance_miles >= 0),
  max_distance_miles integer check (max_distance_miles > 0),
  cabin text not null check (cabin in ('Economy', 'Premium Economy', 'Business', 'First')),
  xp integer not null check (xp >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint xp_rules_dates_valid check (effective_to is null or effective_to >= effective_from),
  constraint xp_rules_band_valid check (
    min_distance_miles is null or max_distance_miles is null or max_distance_miles > min_distance_miles
  )
);

create index xp_rules_user_idx on public.xp_rules (user_id, effective_from);

-- ---------------------------------------------------------------------------
-- exchange_rates (optional; converts original amounts to the reporting currency)
-- ---------------------------------------------------------------------------

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_currency text not null check (from_currency ~ '^[A-Z]{3}$'),
  to_currency text not null check (to_currency ~ '^[A-Z]{3}$'),
  -- 1 unit of from_currency = rate units of to_currency
  rate numeric(18, 8) not null check (rate > 0),
  effective_from date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exchange_rates_pair_valid check (from_currency <> to_currency),
  constraint exchange_rates_unique unique (user_id, from_currency, to_currency, effective_from)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.user_settings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.qualification_cycles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.flight_segments
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.xp_transactions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.credits
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.xp_rules
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.exchange_rates
  for each row execute function private.set_updated_at();
