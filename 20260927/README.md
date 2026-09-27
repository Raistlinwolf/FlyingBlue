# Flying Blue XP Tracker

A mobile-first personal web app (installable PWA) for tracking Flying Blue XP,
trips, qualification cycles, travel spending, SAF, credit-card XP, refunds and
compensation. It replaces an Excel tracker, can import that tracker's
**Earning Log** sheet, and exports everything back to CSV/Excel or a JSON backup.

**Live site:** https://raistlinwolf.github.io/FlyingBlue/ (static; your data is not on GitHub)

**Stack:** Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Row Level Security) · Vitest · GitHub Pages + GitHub Actions.

- Design and data model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Table-by-table schema reference: [docs/DATABASE.md](docs/DATABASE.md)

## How it fits together

```
GitHub Pages (public)            your computer (private)
┌───────────────────────┐        ┌───────────────────────────────┐
│ static HTML/JS/CSS    │  ───▶  │ Supabase in Docker            │
│ no data, no keys      │ browser│ Postgres + Auth + RLS         │
└───────────────────────┘        └───────────────────────────────┘
```

The site is plain static files. It talks to Supabase straight from the browser; the
Supabase URL and publishable key are entered once on the **Connect** screen and kept
in that browser. With a local Supabase the database never leaves your machine.
Row Level Security still applies, so the publishable key is safe to use.

## 快速開始（中文）

1. 開啟 Docker Desktop，在 `20260927/` 執行 `npx supabase start`（第一次會下載映像檔）。
2. `npx supabase status` 找到 **API URL**（`http://127.0.0.1:54321`）和 **Publishable key**。
3. 允許你的 Email 註冊（只需一次）：
   ```bash
   docker exec -it supabase_db_flying-blue-xp-tracker psql -U postgres -c "insert into private.signup_allowlist (email) values ('you@example.com');"
   ```
4. 打開 https://raistlinwolf.github.io/FlyingBlue/ ，在 Connect 頁貼上 URL 和 key。
   Chrome 可能詢問「允許存取本機網路上的裝置」→ 選 **允許**。
5. 註冊並登入 → Settings → Import & export → **Import from Excel**，選你的 Excel 檔，
   確認預覽後按 Import。重複匯入同一檔案只會更新，不會重複。
6. 資料只存在你電腦的 Docker 裡。`npx supabase stop` 會保留資料；
   **不要**執行 `npx supabase db reset`（會清空）。定期到 Settings 下載 JSON 備份。

## Features

- **Quick entry:** floating **+** → Add booking / flight / XP / credit. Multi-segment
  bookings chain automatically (AMS → CPH, then CPH → ___), reuse date, airline and
  cabin, and pre-fill expected XP from the XP rules. "Add return legs" reverses an itinerary.
- **Expected vs actual XP:** each flight or XP transaction is either *actual*
  (credited) or *booked*, never both. "✓ Flown" moves a flight to actual.
- **Dashboard:** calendar year **or** qualification cycle (with XP carried over from the
  previous cycle); XP by source, booked vs actual vs projected against the target,
  gross/net/incremental spending, cost per XP, monthly table and cumulative XP chart.
- **Calendar:** monthly grid with routing, flight count, XP and trip name.
- **History:** filter by period, category, airline, origin, destination, XP source,
  status; search airports, flight numbers, names and references; archive/restore.
- **XP calculator:** great-circle distance + configurable XP rules; "Save as booking".
- **Excel import:** reads the Earning Log sheet, groups flights into bookings, splits
  SAF / credit-card / partner XP and rebuilds qualification cycles (a new cycle starts
  the month after reaching the next level, the surplus carries over).
- **Settings:** preferences, qualification cycles, XP rules, exchange rates,
  import/export, database connection.
- **PWA:** manifest, icons, standalone mode, offline fallback page.

## Project layout

```
src/app/            routes (static pages; each renders a client "screen")
src/components/     UI: screens, forms, dashboard, calendar, history, settings, navigation
src/domain/         pure business logic (XP buckets, costs, periods, calculator, Excel
                    import, CSV) — unit tested
src/lib/store/      database reads/writes from the browser (Supabase client + RLS)
src/lib/supabase/   client with runtime connection settings
supabase/           config.toml, migrations/, seed.sql (local only)
tests/domain/       calculation and import tests
tests/db/           applies every migration to embedded Postgres and checks RLS
.github/workflows/  (repo root) build + deploy to GitHub Pages
```

## Local development

Requirements: Node.js 20.9+ (24 LTS recommended) and Docker Desktop.

```bash
npm install
npx supabase start          # Postgres, Auth, API on 127.0.0.1:54321; applies migrations + seed.sql
cp .env.example .env.local  # paste the publishable key from `npx supabase status`
npm run dev                 # http://localhost:3000
```

`supabase/seed.sql` allow-lists `dev@example.com` for local testing (email
confirmation is disabled locally).

```bash
npm test           # domain, Excel import, migrations + RLS (no Supabase needed)
npm run lint
npm run typecheck
npm run build      # static export into out/
```

## Deploying to GitHub Pages

1. Push to `main`. The workflow `.github/workflows/deploy-pages.yml` (repository root)
   runs the tests, builds with `NEXT_PUBLIC_BASE_PATH=/FlyingBlue` and publishes `out/`.
2. One-time: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   Re-run the workflow if the first run happened before this was switched.
3. Open the site, enter your Supabase URL + publishable key on the Connect screen.

Optional: to use a hosted Supabase project instead of the local one, run
`npx supabase link --project-ref <ref>` and `npx supabase db push`, add your email
to `private.signup_allowlist`, and either enter its URL/key on the Connect screen or
set repository variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as defaults.
Add `https://raistlinwolf.github.io/FlyingBlue/auth/confirm/` to the project's Auth
redirect URLs if email confirmation is on.

## Security model

- Every user-owned table has `user_id` defaulting to `auth.uid()` and RLS policies
  allowing select/insert/update/delete only where `auth.uid() = user_id`.
- Composite foreign keys `(booking_id, user_id)` make it impossible to attach a
  record to someone else's booking.
- Registration is enforced in the database by a trigger that checks
  `private.signup_allowlist` (not reachable through the API).
- The public build contains no database URL or key. Only the publishable key is ever
  used in the browser — never the secret / service-role key.
- `.gitignore` excludes `.env*.local`, spreadsheets (`*.xlsx`) and backup files, so
  personal data does not end up in this public repository.

## Data rules worth knowing

- **Booking price counts once**, never per segment, attributed to the first flight's date.
- **Planned** items are not yet paid: excluded from spending, shown as "planned".
  **Cancelled** items keep their cost; log the refund as a credit.
- **Credits** reduce net cost only when *Reduces net travel cost* is on.
- **Currencies** are stored as entered; foreign amounts need an exchange rate and are
  otherwise excluded and flagged, never assumed EUR.
- **Qualification cycles** are date ranges with a target and *carried-over XP*;
  records belong to a cycle by date, so editing cycles never rewrites history.
- **XP rules** default to the Flying Blue revenue chart (domestic / medium / long-haul
  bands × cabin), editable in Settings.

## Regenerating assets

```bash
npm run db:seed-airports   # rebuilds the airports migration from ../airports.js
npm run icons              # rebuilds PNG icons from public/icon.svg
```
