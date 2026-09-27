# Database schema

Postgres (Supabase). Defined only by the migrations in `supabase/migrations/`:

| Migration | Contents |
|---|---|
| `20260927000100_core_schema.sql` | tables, constraints, indexes, `updated_at` triggers |
| `20260927000200_rls_policies.sql` | Row Level Security policies and grants |
| `20260927000300_auth_and_defaults.sql` | signup allowlist, new-user defaults, default XP chart |
| `20260927000400_seed_airports.sql` | airport reference data (generated) |
| `20260927000500_cycle_carryover.sql` | `carried_over_xp` on qualification cycles |
| `20260927000600_admin_registration.sql` | admins, registration switch, allowlist management, keep-alive |
| `20260927000700_demo_read_only.sql` | read-only demo: `anon` may select one demo account's rows |

Conventions: `id uuid` primary keys (`gen_random_uuid()`); `user_id uuid not null
default auth.uid()` on user-owned tables; `created_at` / `updated_at timestamptz`;
`archived_at timestamptz` for soft delete where records can be removed in the UI;
enumerations as `text` + `CHECK`; money as `numeric(12,2)` with a separate
ISO-4217 `currency` column.

## user_settings

| Column | Type | Notes |
|---|---|---|
| user_id | uuid PK | → auth.users |
| preferred_currency | text | default `EUR`; entry default and reporting currency |
| home_airport | text | IATA, optional |
| default_airline | text | optional |
| default_cabin | text | Economy · Premium Economy · Business · First |
| default_category | text | booking category |
| current_status | text | Explorer · Silver · Gold · Platinum · Ultimate |
| xp_target | integer | default 300; used for calendar-year views and new cycles |
| theme | text | system · light · dark |

## qualification_cycles

| Column | Type | Notes |
|---|---|---|
| name | text | e.g. "FB 2027" |
| start_date, end_date | date | inclusive; `end_date >= start_date` |
| starting_status | text | status at the start of the cycle |
| target_xp | integer | |
| carried_over_xp | integer | surplus XP rolled over from the previous cycle; counts in this cycle only |
| notes | text | |

`EXCLUDE USING gist (user_id WITH =, daterange(start_date, end_date, '[]') WITH &&)` —
cycles of one user can never overlap.

## bookings

| Column | Type | Notes |
|---|---|---|
| booking_reference | text | PNR, optional |
| ticket_number | text | optional |
| booking_name | text | required |
| purchase_date | date | default today |
| category | text | XP Run · Personal Travel · Business Travel · Positioning · Award Travel · Other |
| total_price | numeric | ≥ 0; the price of the whole ticket |
| currency | text | |
| baseline_alternative_price | numeric | optional; what you would have paid anyway |
| status | text | Planned · Booked · Flown · Cancelled |
| notes, archived_at | | |

`unique (id, user_id)` is the target of the composite foreign keys below.
Derived (not stored): `incremental_cost = max(total_price − baseline_alternative_price, 0)`.

## flight_segments

| Column | Type | Notes |
|---|---|---|
| booking_id | uuid | FK `(booking_id, user_id)` → bookings, cascade delete |
| position | smallint | order within the booking |
| flight_date | date | |
| flight_number | text | optional |
| origin_iata, destination_iata | text | `^[A-Z]{3}$`, must differ |
| marketing_airline | text | required |
| operating_airline, fare_class | text | optional |
| cabin | text | Economy · Premium Economy · Business · First |
| expected_xp | integer | ≥ 0 |
| actual_xp | integer | nullable; when set it replaces expected XP |
| segment_status | text | Planned · Booked · Flown · Cancelled |
| notes, archived_at | | |

Airports are referenced by code without a foreign key so a gap in the reference
data never blocks logging a flight.

## xp_transactions

| Column | Type | Notes |
|---|---|---|
| booking_id | uuid | optional; FK `(booking_id, user_id)`, `ON DELETE SET NULL (booking_id)` |
| transaction_date | date | |
| source_type | text | SAF · Credit Card · Promotion · Choice Benefit · Partner · Adjustment · Other |
| description | text | |
| cost | numeric | ≥ 0 (e.g. SAF price, card annual fee) |
| currency | text | |
| expected_xp | integer | may be negative for adjustments |
| actual_xp | integer | nullable |
| status | text | Planned · Pending · Credited · Cancelled |
| notes, archived_at | | |

## credits

| Column | Type | Notes |
|---|---|---|
| booking_id | uuid | optional; FK like above |
| transaction_date | date | |
| credit_type | text | Ticket Refund · Airline Compensation · EC261 Compensation · Expense Reimbursement · Statement Credit · Voucher · Other |
| description | text | |
| amount | numeric | ≥ 0 |
| currency | text | |
| include_in_net_cost | boolean | only `true` reduces net cost |
| notes, archived_at | | |

## airports (global)

| Column | Type | Notes |
|---|---|---|
| iata | text PK | |
| name, city | text | |
| country_code | text | ISO 3166-1 alpha-2; used for domestic detection |
| latitude, longitude | double precision | used for great-circle distance |

Read-only for `authenticated`; no API writes. Generated from the OpenFlights data set
by `scripts/generate-airports-seed.mjs`.

## xp_rules

| Column | Type | Notes |
|---|---|---|
| effective_from, effective_to | date | rule validity; `effective_to` null = open-ended |
| route_category | text | e.g. Domestic, Medium, Long 1 |
| is_domestic | boolean | applies to flights within one country |
| min_distance_miles, max_distance_miles | integer | distance band `[min, max)` for non-domestic rules |
| cabin | text | |
| xp | integer | |
| notes | text | |

Per user. New users receive the default chart via `private.install_default_xp_rules`;
`public.install_default_xp_rules(replace_existing boolean)` lets a signed-in user
(re)install it for themselves only.

## exchange_rates

| Column | Type | Notes |
|---|---|---|
| from_currency, to_currency | text | `1 from = rate to` |
| rate | numeric(18,8) | > 0 |
| effective_from | date | latest rate on or before a transaction date is used |

`unique (user_id, from_currency, to_currency, effective_from)`.

## private.signup_allowlist

| Column | Type | Notes |
|---|---|---|
| email | text PK | lower-case |

Checked by the `before insert` trigger `enforce_signup_allowlist` on `auth.users`.
The `private` schema is not exposed through the Data API.

## private.admins, private.app_config

- `private.admins (user_id)`: accounts with admin rights. Add one in the SQL editor:
  `insert into private.admins (user_id) select id from auth.users where email = '…';`
- `private.app_config.registration_open`: when true, anyone can register; otherwise only
  allow-listed emails.
- `private.app_config.demo_user_id`: the account visitors can browse read-only without
  signing in (null = demo off). `public.demo_user_id()` (security definer, callable by
  `anon`) returns it for the policies below.
- Functions (security definer, admin-checked): `is_admin()`, `admin_registration_status()`,
  `admin_set_registration_open(open)`, `admin_allow_email(target_email, allow)`.
- `keepalive()` returns `now()` for the scheduled GitHub Action; callable anonymously,
  touches no data.

## Row Level Security

For every user-owned table (`user_settings`, `qualification_cycles`, `bookings`,
`flight_segments`, `xp_transactions`, `credits`, `xp_rules`, `exchange_rates`):

```sql
create policy <table>_select_own on <table> for select to authenticated using ((select auth.uid()) = user_id);
create policy <table>_insert_own on <table> for insert to authenticated with check ((select auth.uid()) = user_id);
create policy <table>_update_own on <table> for update to authenticated using (...) with check (...);
create policy <table>_delete_own on <table> for delete to authenticated using (...);
```

Read-only demo (migration 700): each of these tables also has
`<table>_select_demo ... for select to anon using (user_id = (select public.demo_user_id()))`,
and `airports` is readable by `anon`. `anon` holds only `SELECT`, so it can never write;
while `demo_user_id` is null it sees no rows. `tests/db/migrations.test.ts` applies all
migrations to an embedded Postgres and verifies isolation between two users,
the allowlist, composite foreign keys and the cycle-overlap constraint.

## Future extensions the schema allows

- Excel/CSV import: column names match the CSV export.
- Exchange-rate automation: fill `exchange_rates` from an API.
- Offline entry: queue inserts client-side; all ids are client-generatable uuids.
- Multiple users: already isolated by `user_id` + RLS.
