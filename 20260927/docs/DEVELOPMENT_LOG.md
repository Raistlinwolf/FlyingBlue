# Development log — Flying Blue XP Tracker

Hand-over notes for the next developer or coding agent. Read this first, then
[ARCHITECTURE.md](ARCHITECTURE.md) (design), [DATABASE.md](DATABASE.md) (schema) and the
[README](../README.md) (usage, setup). Everything below reflects the state at commit
`3d18cd4` plus the commit that added this sentence (2026-09-27).

## 1. What this is

A personal, single-owner web app that replaces an Excel tracker for Flying Blue XP:
bookings and flight segments, SAF / credit-card / partner XP, refunds, qualification
cycles (QC), costs and cost per XP, calendar, history, XP calculator, Excel import,
JSON/CSV export. Installable PWA; mobile-first.

- **Live:** https://raistlinwolf.github.io/FlyingBlue/ (GitHub Pages, static)
- **Database:** Supabase cloud project `jczyrhbgqvttqkhcahmk` (Frankfurt, free plan)
- **Code:** `20260927/` in `Raistlinwolf/FlyingBlue` (the repo root also holds an older
  vanilla-JS prototype: `index.html`, `airports.js`, … — untouched, and `airports.js`
  is the source of the airport seed).

## 2. Current architecture (short)

```
Browser ── static Next.js export (GitHub Pages, basePath /FlyingBlue)
   └── supabase-js ──HTTPS──▶ Supabase: Postgres + Auth + RLS (+ SQL functions)
```

- **No application server.** Next.js 16 `output: 'export'`; every page is a client
  "screen" (`src/components/screens/*`) wrapped by a thin `page.tsx` (metadata + Suspense).
- **Data flow:** `TrackerProvider` loads all of the user's rows once
  (`src/lib/store/queries.ts → loadEverything`), screens compute from that snapshot with
  pure functions in `src/domain/*`, and every successful write calls `reload()`
  (via `useAction`). Writes live in `src/lib/store/*.ts` and are validated with Zod
  (`src/lib/validation.ts`).
- **Security boundary = RLS** (`auth.uid() = user_id` on every user table, composite FKs
  `(booking_id, user_id)`). The client-side `AuthGate` only decides what to show.
- **Connection config:** build-time `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (set in `.github/workflows/deploy-pages.yml`),
  overridable per browser on `/connect` (stored in `localStorage` key `fbxp.supabase`).
  A browser with a saved connection ignores the built-in one until "Forget saved
  connection".
- **Business rules** are in `src/domain` (XP buckets, costs, periods, QC counter,
  calculator, Excel import) or in the DB (`xp_rules`). UI components don't hold rules.

## 3. Timeline of the first day (2026-09-27)

1. **Initial build (server version).** Next.js App Router with server components,
   server actions, `proxy.ts` session refresh, route-handler exports; Supabase local via
   Docker. Schema + RLS + allowlist trigger + default XP chart + 6,053-airport seed
   (generated from the prototype's `airports.js` + OpenFlights country codes).
   Domain layer with the 10 required calculation tests. Verified end-to-end with
   Playwright against local Supabase.
2. **Static rewrite for GitHub Pages.** Owner wanted GitHub hosting. Server actions,
   proxy, cookies and dynamic routes are not supported by static export, so: all data
   access moved to the browser (`src/lib/store`), dynamic routes became `?id=` query
   routes (`/booking`, `/flight`, `/xp`, `/credit`), theme moved to localStorage,
   exports became Blob downloads, a `/connect` screen was added.
3. **Excel import.** `src/domain/earning-log.ts` reads the owner's "Earning Log" sheet
   (年度 · 分類 · 日期 · 起飛 · 降落 · 價格 · 飛行XP · SAF價格 · SAF XP · 信用卡年費 · 信用卡XP · 其他XP),
   groups segments into bookings, splits SAF/card/partner XP, and rebuilds QCs from
   credited XP. `qualification_cycles.carried_over_xp` (migration 500) holds rollover so
   it counts in the cycle only. Verified: the owner's monthly totals matched their sheet
   exactly (Explorer → Silver 2025-12 carry 94 → Gold 2026-03 carry 56).
4. **Dashboard: QC XP counter** (`src/domain/qualification.ts`, `XpCounterChart`):
   monthly stacked bars (credited + booked). Explorer/Silver/Gold start a new QC the
   month after reaching the target with the surplus; Platinum deducts 300 at the end of
   the 12-month QC; user-defined cycles stay authoritative. Spending / XP-by-source cards
   were aligned to the tiles' 5-column grid.
5. **Bug fix:** setting a booking from Flown back to Booked left its segments Flown
   (credited XP kept counting). Now it cascades; flown segments have "Undo flown";
   single-row updates verify a row changed (RLS makes invisible-row updates silent no-ops).
6. **Cloud move.** Supabase cloud project, migrations pushed with the CLI, owner (admin)
   and test accounts created, backup restored into the owner's account, registration
   closed. Added: admin panel + registration switch (migration 600), change password,
   Cancel on Add screens, connection links for other devices, keep-alive workflow.
7. **Airline input fix.** On Add flight the airline list only offered "UNKNOWN": the
   form prefills the chosen booking's last airline, which for imported bookings is the
   import placeholder, and a native `<datalist>` only suggests options matching the
   current text. Now `UNKNOWN_AIRLINE` (`src/domain/earning-log.ts`) is never suggested
   or prefilled (`src/lib/entry-context.ts`; falls back to Settings → Default airline),
   and `AirlineInput` empties the box on focus (current value shown as placeholder) so
   the full list appears; leaving it untouched keeps the value.
8. **Read-only demo + security review.** Migration 700 lets role `anon` *select* the
   rows of `private.app_config.demo_user_id` (plus `airports`); anon has no write
   privileges anywhere. Login has **Try the demo** (`src/lib/demo.ts`, a sessionStorage
   flag): `loadEverything` skips the session, `useAction` refuses writes with a
   message, AppShell shows a banner and "Exit demo". The test account's password was
   removed from the README and changed. The Connect screen now warns when a connection
   link points at a database other than the built-in one (a link could otherwise send a
   user's password to someone else's Supabase). Review findings: no secrets in the
   history; the live API denies anon everything except `keepalive` (and, after 700, the
   demo rows); signup is rejected by the allowlist trigger.
   - **Demo data** was written into `dev@example.com` through the public API as that
     user (so RLS applied): Silver → Gold cycle "FB 2026" (target 180, carry-over 12),
     6 bookings `DEMO01`–`DEMO06` (flown / booked / planned / cancelled, KL·SK·AF·CI,
     one priced in TWD), 15 flights, 4 XP transactions (card, SAF, promotion), 3 credits
     (EC261, refund, employer reimbursement), a TWD→EUR rate. Re-create it with
     `scripts/seed-demo.ps1` (asks for the password; refuses if bookings exist).
   - **Test password:** the public one was replaced by a random password (owner has
     it), then `logout?scope=global` revoked every session; verified the old one fails.
   - **Migration 700 applied by the owner** in the SQL editor (with the
     `demo_user_id` update and the `schema_migrations` row). Verified from outside with
     the publishable key only: anon reads exactly the demo rows (6 / 15 / 4 / 3 / 1 / 1)
     and AMS from `airports`; insert, update and delete on `bookings` return 42501.
     Deploy run for `3d18cd4` green; the live login page ships "Try the demo".

Commits: `9126f45` → `fa7fc7a` → `5e2280c` → `b6bffba` → `2435fa2` → `88b3b2c` (airline
input) → `3d18cd4` (read-only demo, security review).

## 4. Current state

| Item | State |
|---|---|
| Tests | 65 passing in CI (`npm test`): domain calculations, Excel import, QC counter, migrations + RLS (incl. read-only demo) on PGlite |
| Lint / typecheck | clean (`npm run lint`, `npm run typecheck`) |
| Deploy | green; push to `main` touching `20260927/**` deploys automatically |
| Cloud DB | all 7 migrations applied (700 by hand in the SQL editor, recorded in `supabase_migrations.schema_migrations`); registration closed; allowlist empty |
| Accounts | owner = admin (holds the real data); `dev@example.com` = demo account with sample data (bookings `DEMO01`–`DEMO06`), set as `private.app_config.demo_user_id`; its password is known only to the owner (the old public one was changed on 2026-09-27 and all sessions revoked) |
| Keep-alive | `.github/workflows/keepalive.yml`, every 3 days → `rpc/keepalive` |
| Local Supabase (Docker) | still has an older copy of the data under `dev@example.com`; not used by the live site |
| Backups | owner keeps JSON + SQL backups outside the repo (`D:\Users\Rhys\Documents\FlyingBlue-backups\`) |

Credentials are **not** stored anywhere in the repo. The admin account's email and
password belong to the owner. The Supabase access token used for the cloud setup was
meant to be revoked after use — do not expect CLI access; ask the owner for a new
short-lived token (`sbp_…`) when you need `supabase db push`.

## 5. How to work on it

```bash
cd 20260927
npm install
npm test && npm run lint && npm run typecheck
npm run dev                      # http://localhost:3000, uses .env.local (local Supabase by default)
```

- **Schema changes:** add a new file in `supabase/migrations/` (never edit applied ones),
  extend `tests/db/migrations.test.ts`, then push to the cloud:
  `SUPABASE_ACCESS_TOKEN=sbp_… npx supabase link --project-ref jczyrhbgqvttqkhcahmk`
  and `npx supabase db push --linked` (the CLI creates a temporary login role; no DB
  password needed). Run SQL ad hoc via the Management API
  (`POST https://api.supabase.com/v1/projects/<ref>/database/query`).
- **Static build like CI:** `NEXT_PUBLIC_BASE_PATH=/FlyingBlue npm run build` → `out/`.
- **Admins / registration:** `private.admins`, `private.app_config.registration_open`,
  `private.signup_allowlist`; functions `is_admin`, `admin_set_registration_open`,
  `admin_allow_email`, `admin_registration_status` (all admin-checked).

## 6. Gotchas learned the hard way

- **Next.js 16 is not the Next.js in your training data.** Read
  `node_modules/next/dist/docs/` before changing framework-level code (middleware is
  `proxy.ts`, request APIs are async-only, `next lint` is gone, Turbopack by default).
- **Windows static export bug:** on Windows the exported segment prefetch files are
  written into nested folders (`__next.!KGFwcCk/dashboard/__PAGE__.txt`) instead of
  dotted names, causing 404s on client navigation. Linux (CI) builds are correct. For
  local Windows testing run `node scripts/fix-windows-export.mjs out` after the build.
- **GitHub Pages source must be "GitHub Actions".** While it was still "Deploy from a
  branch", every push ran both our workflow and GitHub's built-in "pages build and
  deployment" (which publishes the repo root = the old prototype); whichever finished
  last won, so the live site flipped between versions. Fixed on 2026-09-27 in
  Settings → Pages. If the old "Flying Blue XP 計算器" page ever reappears, check this first.
- **Git Bash path conversion** turns `NEXT_PUBLIC_BASE_PATH=/FlyingBlue` into a Windows
  path; prefix with `MSYS_NO_PATHCONV=1`.
- **The owner's machine has no Node.js installed**; advice must not assume `npx` works
  there (README documents `winget install OpenJS.NodeJS.LTS`).
- **React 19 form actions reset uncontrolled inputs** after submit; the login form uses
  `onSubmit` so a failed attempt keeps the password.
- **React Compiler lint** rejects setState-in-effect and refs written during render; use
  functional state updates, `useSyncExternalStore` (see `useConfig`), or lazy state init.
- **Supabase free plan** pauses after ~7 days idle (hence keep-alive) and has no
  downloadable backups (hence JSON backups).
- **Booking vs segment status:** XP is computed from segments. Any feature that changes a
  booking's status must decide what happens to its segments.
- **`<datalist>` filters by the input's text.** A prefilled input shows only matching
  suggestions. `AirlineInput` works around it (see timeline item 7); `AirportInput`
  still has the plain behaviour.
- **The demo account's data is world-readable.** Never put real data in the account
  that `demo_user_id` points at. Writes in demo mode must go through `useAction` (which
  blocks them); the database refuses them regardless.
- **Migrations applied by hand** (SQL editor, when no `sbp_` token is available) must be
  re-runnable and recorded in `supabase_migrations.schema_migrations`, or a later
  `supabase db push` tries to apply them again.
- **Playwright pitfall:** `waitForURL(/dashboard/)` also matches
  `/login/?next=%2Fdashboard%2F`; match on the pathname.

## 7. Open items / ideas

- Excel import cannot know airlines (no column) → imported flights use the placeholder
  airline `UNKNOWN`; category defaults to the owner's default category; purchase date =
  first flight date. Existing `UNKNOWN` segments still need fixing by hand (edit per
  flight, or SQL `update flight_segments set marketing_airline = 'KL' where
  marketing_airline = 'UNKNOWN'` after a backup); a bulk "replace airline" tool in
  Settings is an option.
- Hardening ideas: MFA (TOTP) for the admin account; a Content-Security-Policy `<meta>`
  (GitHub Pages cannot send headers); pin GitHub Actions to commit SHAs.
- QC 12-month rules for Silver/Gold without upgrade (requalify or drop one level) are an
  assumption; the owner only specified the upgrade and Platinum −300 rules.
- Not done yet: offline entry (queue writes in IndexedDB), exchange-rate automation,
  CSV (not JSON) import, Ultimate/UXP tracking, partner-airline-specific XP rules.
