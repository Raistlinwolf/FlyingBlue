# Flying Blue XP Tracker

A mobile-first personal web app (installable PWA) for tracking Flying Blue XP,
trips, qualification cycles, travel spending, SAF, credit-card XP, refunds and
compensation. It replaces an Excel tracker, can import that tracker's
**Earning Log** sheet, and exports everything back to CSV/Excel or a JSON backup.

**Live site:** https://raistlinwolf.github.io/FlyingBlue/ (static; data lives in Supabase, not on GitHub)

**Stack:** Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Row Level Security) · Vitest · GitHub Pages + GitHub Actions.

- Design and data model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Table-by-table schema reference: [docs/DATABASE.md](docs/DATABASE.md)
- Hand-over notes for developers / coding agents: [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md)
- Project summary (portfolio / CV): [docs/CV_SIDE_PROJECT.md](docs/CV_SIDE_PROJECT.md)

## How it fits together

```
GitHub Pages (public)                 Supabase cloud (project jczyrhbgqvttqkhcahmk, Frankfurt)
┌───────────────────────┐   HTTPS    ┌──────────────────────────────────────┐
│ static HTML/JS/CSS    │  ───────▶  │ Postgres + Auth + Row Level Security │
│ no data, no secrets   │  browser   │ registration closed, admin-managed   │
└───────────────────────┘            └──────────────────────────────────────┘
```

The site is plain static files that talk to Supabase straight from the browser. The
build has the project URL and **publishable** key built in (public by design), so any
device opens straight to the sign-in screen. Row Level Security keeps every account's
data private, registration is closed, and an admin can reopen it from Settings.
The secret / service-role key and the database password are never used by the app.

## 使用方式（中文）

### 在任何裝置上使用

1. 打開 **https://raistlinwolf.github.io/FlyingBlue/**（電腦、iPhone、iPad 都一樣）。
2. 用你的帳號登入。資料存在 Supabase 雲端，這台電腦不需要開著。
3. 想裝成 App：iPhone／iPad Safari → 分享 → **加入主畫面**；Android Chrome → 選單 → **安裝應用程式**；
   電腦 Chrome／Edge → 網址列的安裝圖示。

**這台電腦的瀏覽器**先前存過本機資料庫的連線，會優先使用它。請到登入頁下方按 **change**
→ Connect 頁按 **Forget saved connection**，就會改用雲端。

### 帳號與管理員

- **管理員帳號**：可以在 Settings → **Admin · registration**
  - 開啟／關閉註冊（開啟時任何人都能註冊，用完請關閉）
  - 只邀請特定 Email（加入允許名單，對方即可註冊）
- **唯讀展示（Demo）**：登入頁按 **Try the demo**，不需帳號即可瀏覽一個展示帳號的範例資料，
  資料庫只允許讀取、不能修改。展示帳號的密碼只有擁有者知道（不寫在 repo）。
  更換或關閉展示帳號（Supabase SQL Editor）：
  ```sql
  update private.app_config set demo_user_id = (select id from auth.users where email = '展示帳號 email');
  update private.app_config set demo_user_id = null;  -- 關閉展示
  ```
- **修改密碼**：Settings → Account & database → **Change password**（需先輸入目前密碼）。
- 新增管理員（在 Supabase 網頁 SQL Editor 執行）：
  ```sql
  insert into private.admins (user_id) select id from auth.users where email = 'someone@example.com';
  ```

### 雲端連線資訊

| 欄位 | 值 |
|---|---|
| Supabase API URL | `https://jczyrhbgqvttqkhcahmk.supabase.co` |
| Publishable key | `sb_publishable_MjgDfM3Q2eeLOdDlvrggAQ_4qH6OKn3` |

網站已內建這組連線，一般不需要輸入。publishable key 本來就是公開給瀏覽器用的；
**secret key 和資料庫密碼絕對不要貼到網站或 repo**。Supabase 網頁：
https://supabase.com/dashboard/project/jczyrhbgqvttqkhcahmk

### 免費方案注意事項

- 專案閒置約 7 天會被暫停。repo 裡的 **Keep Supabase awake** workflow 每 3 天自動連線一次避免暫停
  （若 repo 60 天沒有任何 commit，GitHub 會停用排程，到 Actions 重新啟用即可）。
  萬一被暫停：到 Supabase 網頁按 **Restore project**，資料不會遺失。
- 免費方案沒有可下載的自動備份：請定期到 Settings 下載 JSON 備份。

### 備份與還原

- **App 備份**：Settings → Import & export → **Download JSON backup**。
  還原：同頁 *Restore from JSON backup*（依 id 新增或更新；XP 規則會以備份內容取代）。
- **Excel 匯入**：同頁 **Import from Excel**，讀取原試算表的 Earning Log 工作表，重複匯入只會更新。
- 備份檔含個人資料，請放在 repo 以外的資料夾（`.gitignore` 已排除 `flying-blue-backup-*.json`、`*.xlsx`）。

### 本機資料庫（選用，開發用）

電腦上的 Docker 版 Supabase 仍可用來開發或離線測試（需要 Docker Desktop 與 Node.js）：

```bat
winget install OpenJS.NodeJS.LTS   & rem 若出現 'npx' is not recognized
cd 20260927
npx supabase start                 & rem 本機 URL http://127.0.0.1:54321
npx supabase stop                  & rem 停止（資料保留）；不要用 db reset，會清空
```

本機預設 publishable key：`sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`（每台電腦都一樣，不是秘密）。
本機整個資料庫備份（只需要 Docker）：
`docker exec supabase_db_flying-blue-xp-tracker pg_dump -U postgres --data-only --schema=public --schema=auth --schema=private postgres > backup.sql`

## 功能（中文）

- **快速輸入**：右下角／底部的 **+** → 新增訂票、航班、XP、退款／補償。
  多段航班會自動接續（AMS → CPH 之後，下一段起點自動帶 CPH），並沿用日期、航空公司、艙等；
  依 XP 規則自動估算預計 XP。「Add return legs」可一鍵加入回程。
- **預計 vs 實際 XP**：每一筆航班或 XP 只會算在「已入帳」或「已訂」其中一邊，不會重複計算。
  按「✓ Flown」即把航班轉為已入帳。
- **儀表板**：可切換「日曆年」或「資格週期（QC）」。
  - XP 來源分析（航班、SAF、信用卡、促銷、Choice Benefits、其他）、已入帳／已訂／預估 XP 對照目標。
  - 花費：總支出、退款、淨支出、增量支出，以及每 XP 成本。
  - **QC XP 計數長條圖**：Explorer／Silver／Gold 達到目標後，下個月進入新的 QC 並結轉超出的 XP；
    Platinum 在 12 個月的 QC 結束時扣除 300 XP，其餘結轉。
  - 每月明細表（入帳、已訂、QC 計數、航段數、花費）。
- **行事曆**：每月行程，顯示航線、航段數、XP 和行程名稱；點日期看當天明細。
- **歷史紀錄**：依期間、類別、航空公司、起訖點、XP 來源、狀態篩選；可搜尋機場、航班號、
  名稱、訂位代號；支援封存與還原。
- **XP 計算機**：依機場座標算大圓距離，套用可編輯的 XP 規則；可「Save as booking」直接存成訂票。
- **Excel 匯入**：讀取原本試算表的 Earning Log 工作表，自動把航段歸成訂票、拆出 SAF／信用卡／
  合作夥伴 XP，並依 Flying Blue 規則重建資格週期與結轉 XP。重複匯入只會更新。
- **設定**：偏好設定（家鄉機場、預設航空公司／艙等／類別、幣別、會籍、目標、主題）、資格週期、
  XP 規則、匯率、匯入／匯出、資料庫連線、修改密碼、複製連線連結給其他裝置；管理員另有註冊開關與邀請名單。
- **取消**：新增訂票／航班／XP／退款的畫面都有 **Cancel**，回到 Dashboard。
- **PWA**：可安裝到手機或電腦桌面，支援深色模式與離線提示頁。

## Features

- **Quick entry:** floating **+** → Add booking / flight / XP / credit. Multi-segment
  bookings chain automatically (AMS → CPH, then CPH → ___), reuse date, airline and
  cabin, and pre-fill expected XP from the XP rules. "Add return legs" reverses an itinerary.
- **Expected vs actual XP:** each flight or XP transaction is either *actual*
  (credited) or *booked*, never both. "✓ Flown" moves a flight to actual.
- **Dashboard:** calendar year **or** qualification cycle (with XP carried over from the
  previous cycle); XP by source, booked vs actual vs projected against the target,
  gross/net/incremental spending, cost per XP, monthly table and a QC XP-counter bar
  chart (Explorer/Silver/Gold: a new QC starts the month after reaching the target, the
  surplus carries over; Platinum: 300 XP is deducted at the end of the 12-month QC).
- **Calendar:** monthly grid with routing, flight count, XP and trip name.
- **History:** filter by period, category, airline, origin, destination, XP source,
  status; search airports, flight numbers, names and references; archive/restore.
- **XP calculator:** great-circle distance + configurable XP rules; "Save as booking".
- **Excel import:** reads the Earning Log sheet, groups flights into bookings, splits
  SAF / credit-card / partner XP and rebuilds qualification cycles (a new cycle starts
  the month after reaching the next level, the surplus carries over).
- **Settings:** preferences, qualification cycles, XP rules, exchange rates,
  import/export, database connection, change password, connection link for other
  devices; admins also get the registration switch and invite list.
- **Cancel** on every Add screen returns to the dashboard.
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
confirmation is disabled locally; pick any password when you register it).

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
- Registration is enforced in the database by a trigger: allowed only while an admin has
  switched it on, or for emails on `private.signup_allowlist`. Admins (`private.admins`)
  manage both through security-definer functions that check admin rights on every call.
- **Read-only demo:** visitors without an account (role `anon`) may *select* the rows of
  one demo account (`private.app_config.demo_user_id`, null = demo off) and nothing else;
  `anon` has no insert/update/delete privileges on any table.
- The build contains the project URL and the **publishable** key (public by design).
  The secret / service-role key and the database password are never used by the app
  and must never be committed.
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
