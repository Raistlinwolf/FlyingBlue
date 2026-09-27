# Flying Blue XP Tracker

A mobile-first personal web app (installable PWA) for tracking Flying Blue XP, trips,
qualification cycles, travel spending, SAF, credit-card XP, refunds and compensation.

手機優先的個人網頁 App（可安裝的 PWA），用來記錄 Flying Blue XP、行程、資格週期、旅行花費、
SAF、信用卡 XP、退款與補償。

**Live site / 網站：** https://raistlinwolf.github.io/FlyingBlue/

**Stack:** Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Row Level Security) · Vitest · GitHub Pages + GitHub Actions.

| | |
|---|---|
| Design and data model / 設計與資料模型 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Table-by-table schema / 資料表說明 | [docs/DATABASE.md](docs/DATABASE.md) |
| Hand-over notes / 開發交接紀錄 | [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) |
| Project summary (portfolio / CV) / 專案摘要 | [docs/CV_SIDE_PROJECT.md](docs/CV_SIDE_PROJECT.md) |

```
GitHub Pages (public)                 Supabase cloud (project jczyrhbgqvttqkhcahmk, Frankfurt)
┌───────────────────────┐   HTTPS    ┌──────────────────────────────────────┐
│ static HTML/JS/CSS    │  ───────▶  │ Postgres + Auth + Row Level Security │
│ no data, no secrets   │  browser   │ registration closed, admin-managed   │
└───────────────────────┘            └──────────────────────────────────────┘
```

**語言 / Language：** [中文](#中文) · [English](#english)

---

## 中文

### 架構簡介

網站是純靜態檔案，由瀏覽器直接連到 Supabase。建置時已內建專案 URL 和 **publishable** key
（本來就是公開的），所以任何裝置打開就是登入畫面。Row Level Security 讓每個帳號的資料互相隔離；
註冊預設關閉，管理員可在 Settings 重新開啟。App 從不使用 secret / service-role key 或資料庫密碼。
資料存在 Supabase，不在 GitHub。

### 在任何裝置上使用

1. 打開 **https://raistlinwolf.github.io/FlyingBlue/**（電腦、iPhone、iPad 都一樣）。
2. 用你的帳號登入。資料存在 Supabase 雲端，這台電腦不需要開著。
3. 想裝成 App：iPhone／iPad Safari → 分享 → **加入主畫面**；Android Chrome → 選單 → **安裝應用程式**；
   電腦 Chrome／Edge → 網址列的安裝圖示。

如果這台電腦的瀏覽器先前存過本機資料庫的連線，會優先使用它。請到登入頁下方按 **change**
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
  展示帳號的資料任何人都看得到，不要放真實資料。範例資料可用 `scripts/seed-demo.ps1` 重建。
- **修改密碼**：Settings → Account & database → **Change password**（需先輸入目前密碼）。
- **新增管理員**（在 Supabase 網頁 SQL Editor 執行）：
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

### 用自己的 Supabase 自架（給其他人使用）

想用這個工具的人，建議開自己的免費 Supabase 專案，資料就完全屬於自己，這個網站的擁有者看不到。
有兩種做法：**A** 只換資料庫，沿用這個網站；**B** 連網站也自己架（fork）。

**步驟 1｜建立資料庫（A、B 都要做）**

1. 到 https://supabase.com 註冊，**New project**（免費方案即可，區域選離自己近的，例如 Frankfurt 或 Tokyo）。
2. 左側 **SQL Editor**，依檔名順序，把 [`supabase/migrations/`](supabase/migrations/) 的 7 個檔案逐一貼上並執行
   （`000100` → `000700`）。`000400_seed_airports.sql` 是機場資料，約 500 KB，貼上與執行要多等一下。
   **不要**執行 `supabase/seed.sql`（那是本機開發用的）。
   已安裝 Node.js 的話，也可以改用 CLI：`npx supabase link --project-ref <ref>`，再 `npx supabase db push`。
3. 允許自己註冊（註冊預設關閉），在 SQL Editor 執行：
   ```sql
   insert into private.signup_allowlist (email) values ('你的 email');
   ```
4. **Authentication → URL Configuration**：在 Redirect URLs 加入網站的確認頁
   （做法 A：`https://raistlinwolf.github.io/FlyingBlue/auth/confirm/`；做法 B：`https://<你的帳號>.github.io/<repo 名稱>/auth/confirm/`），
   註冊確認信的連結才會帶回網站。
5. **Project Settings → API Keys**：記下 Project URL（`https://xxxx.supabase.co`）和 **Publishable key**（`sb_publishable_…`）。
   **Secret key（service-role）和資料庫密碼不要給任何人，也不要貼到網站上。**

**做法 A｜沿用這個網站（最簡單，不用安裝任何東西）**

1. 打開 `https://raistlinwolf.github.io/FlyingBlue/connect/`，貼上自己的 URL 和 Publishable key，按 **Connect**。
2. 回到登入頁 → **Create an account**，用步驟 1-3 允許的 email 註冊並收信確認，然後登入。
3. 其他裝置：在 Settings → **Account & database** 複製連線連結，傳到手機打開即可（連線設定只存在各自的瀏覽器）。
4. 注意：這個網站的程式碼仍由原作者維護與部署。若想完全掌控程式碼，請用做法 B。

**做法 B｜Fork 整個專案，自己的 GitHub Pages**

1. 在 GitHub 把這個 repo **Fork** 到自己的帳號。
2. Fork 的 repo → **Settings → Secrets and variables → Actions → Variables**，新增兩個 *variables*（不是 secrets）：
   `SUPABASE_URL` = 你的 Project URL，`SUPABASE_PUBLISHABLE_KEY` = 你的 Publishable key。
   **沒設的話，建置會沿用這個 repo 內建的 Supabase 專案**，網站會連到別人的資料庫而無法使用。
3. **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
4. **Actions** 分頁：啟用 workflows（fork 預設停用），執行 **Deploy XP Tracker to GitHub Pages** → *Run workflow*。
   如果 repo 名稱不是 `FlyingBlue`，先把 `.github/workflows/deploy-pages.yml` 裡的 `NEXT_PUBLIC_BASE_PATH: /FlyingBlue` 改成 `/<你的 repo 名稱>`。
5. 打開 `https://<你的帳號>.github.io/<repo 名稱>/`，註冊並登入。
6. **Keep Supabase awake** workflow 也會用這兩個 variables 每 3 天連線一次，避免免費專案閒置被暫停。

**之後（A、B 都適用）**

- 讓自己成為管理員（可在 Settings 開關註冊、邀請 email）：
  ```sql
  insert into private.admins (user_id) select id from auth.users where email = '你的 email';
  ```
- 做法 A 沒有 keep-alive：專案閒置約 7 天會暫停，到 Supabase 網頁按 **Restore project** 即可，資料不會遺失。
- 登入頁的 **Try the demo** 在新資料庫上是空的；要開放唯讀展示，先建一個展示帳號放範例資料，再執行
  `update private.app_config set demo_user_id = (select id from auth.users where email = '展示帳號 email');`
  （展示帳號的資料任何人都看得到，不要放真實資料）。
- 定期在 Settings 下載 JSON 備份，免費方案沒有可下載的自動備份。

### 功能

- **快速輸入**：右下角／底部的 **+** → 新增訂票、航班、XP、退款／補償。
  多段航班會自動接續（AMS → CPH 之後，下一段起點自動帶 CPH），並沿用日期、航空公司、艙等；
  依 XP 規則自動估算預計 XP。「Add return legs」可一鍵加入回程。
- **預計 vs 實際 XP**：每一筆航班或 XP 只會算在「已入帳」或「已訂」其中一邊，不會重複計算。
  按「✓ Flown」即把航班轉為已入帳。
- **儀表板**：可切換「日曆年」或「資格週期（QC）」（含上一期結轉的 XP）。
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
  合作夥伴 XP，並依 Flying Blue 規則重建資格週期與結轉 XP（達到下一級的隔月開始新週期）。重複匯入只會更新。
- **唯讀展示**：登入頁 **Try the demo**，不需帳號即可瀏覽範例資料。
- **設定**：偏好設定（家鄉機場、預設航空公司／艙等／類別、幣別、會籍、目標、主題）、資格週期、
  XP 規則、匯率、匯入／匯出、資料庫連線、修改密碼、複製連線連結給其他裝置；管理員另有註冊開關與邀請名單。
- **取消**：新增訂票／航班／XP／退款的畫面都有 **Cancel**，回到 Dashboard。
- **PWA**：可安裝到手機或電腦桌面（獨立視窗），支援深色模式與離線提示頁。

### 資料規則

- **訂票價格只算一次**，不會按航段重複計算，歸在第一段航班的日期。
- **Planned（計畫中）** 表示還沒付款：不計入花費，另外顯示為「planned」。
  **Cancelled（已取消）** 仍保留原本的花費；退款請另外記成一筆 credit。
- **Credits（退款／補償）** 只有勾選 *Reduces net travel cost* 時才會降低淨花費。
- **幣別** 依輸入原樣保存；外幣金額需要有匯率，否則不計入並標示提醒，絕不假設為 EUR。
- **資格週期** 是有目標與 *結轉 XP* 的日期區間；紀錄依日期歸屬週期，所以修改週期不會改寫歷史資料。
- **XP 規則** 預設為 Flying Blue 付費機票表（國內／中程／長程距離級距 × 艙等），可在 Settings 修改。

### 安全模型

- 每個使用者資料表都有預設為 `auth.uid()` 的 `user_id`，RLS 只允許在 `auth.uid() = user_id` 時
  讀取／新增／修改／刪除。
- 複合外鍵 `(booking_id, user_id)` 讓紀錄無法掛到別人的訂票上。
- 註冊由資料庫 trigger 把關：只有管理員開啟註冊時，或 email 在 `private.signup_allowlist` 裡才能註冊。
  管理員（`private.admins`）透過 security-definer 函式管理這兩者，每次呼叫都會檢查管理員權限。
- **唯讀展示**：沒有帳號的訪客（role `anon`）只能 *讀取* 一個展示帳號的資料
  （`private.app_config.demo_user_id`，null 表示關閉），其他都看不到；`anon` 在任何資料表都沒有新增／修改／刪除權限。
- 建置內含專案 URL 和 **publishable** key（本來就是公開的）。secret / service-role key 和資料庫密碼
  App 從不使用，也絕對不能 commit。
- `.gitignore` 排除 `.env*.local`、試算表（`*.xlsx`）和備份檔，個人資料不會進到這個公開 repo。

### 專案結構

```
src/app/            路由（靜態頁面，各自渲染一個 client「screen」）
src/components/     UI：screens、表單、儀表板、行事曆、歷史紀錄、設定、導覽
src/domain/         純商業邏輯（XP 分類、花費、期間、計算機、Excel 匯入、CSV），有單元測試
src/lib/store/      瀏覽器端的資料庫讀寫（Supabase client + RLS）
src/lib/supabase/   可在執行時切換連線的 client
supabase/           config.toml、migrations/、seed.sql（僅本機）
scripts/            產生機場資料與圖示、Windows 匯出修正、展示資料（seed-demo.ps1）
tests/domain/       計算與匯入測試
tests/db/           把所有 migration 套到嵌入式 Postgres 並檢查 RLS
.github/workflows/  （repo 根目錄）建置 + 部署到 GitHub Pages、keep-alive
```

### 本機開發

需要 Node.js 20.9+（建議 24 LTS）與 Docker Desktop。Windows 若出現 `'npx' is not recognized`，
先執行 `winget install OpenJS.NodeJS.LTS`。

```bash
cd 20260927
npm install
npx supabase start          # 本機 Postgres、Auth、API（127.0.0.1:54321），套用 migrations + seed.sql
cp .env.example .env.local  # 貼上 `npx supabase status` 顯示的 publishable key
npm run dev                 # http://localhost:3000
npx supabase stop           # 停止（資料保留）；不要用 db reset，會清空
```

- `supabase/seed.sql` 把 `dev@example.com` 加入本機允許名單（本機不需 email 確認；註冊時自訂密碼）。
- 本機預設 publishable key：`sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`（每台電腦都一樣，不是秘密）。
- 本機整個資料庫備份（只需要 Docker）：
  `docker exec supabase_db_flying-blue-xp-tracker pg_dump -U postgres --data-only --schema=public --schema=auth --schema=private postgres > backup.sql`

```bash
npm test           # 計算、Excel 匯入、migrations + RLS（不需要 Supabase）
npm run lint
npm run typecheck
npm run build      # 靜態匯出到 out/
```

### 部署到 GitHub Pages

1. Push 到 `main`（變更在 `20260927/**` 內）。workflow `.github/workflows/deploy-pages.yml`（repo 根目錄）
   會跑測試與 lint，以 `NEXT_PUBLIC_BASE_PATH=/FlyingBlue` 建置並發布 `out/`。
2. 一次性設定：**Settings → Pages → Build and deployment → Source: GitHub Actions**。
   若第一次執行時還沒切換，切換後重新執行 workflow。
3. 建置使用 repository variables `SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY`；沒設定時使用內建的雲端專案。
   使用者也可以在 Connect 頁改成其他資料庫（只存在該瀏覽器）。

### 重新產生資源

```bash
npm run db:seed-airports   # 從 ../Draft/airports.js 重建機場 migration
npm run icons              # 從 public/icon.svg 重建 PNG 圖示
```

---

## English

### Overview

The site is plain static files that talk to Supabase straight from the browser. The
build has the project URL and **publishable** key built in (public by design), so any
device opens straight to the sign-in screen. Row Level Security keeps every account's
data private; registration is closed and an admin can reopen it from Settings. The app
never uses the secret / service-role key or the database password. Data lives in
Supabase, not on GitHub.

### Using it on any device

1. Open **https://raistlinwolf.github.io/FlyingBlue/** (computer, iPhone, iPad alike).
2. Sign in with your account. Data lives in Supabase cloud; this computer does not need to be on.
3. To install as an app: iPhone/iPad Safari → Share → **Add to Home Screen**; Android Chrome →
   menu → **Install app**; desktop Chrome/Edge → the install icon in the address bar.

If a browser previously saved a connection to the local database, it keeps using it.
On the sign-in page press **change** → on the Connect page press **Forget saved
connection** to switch to the cloud.

### Accounts and admins

- **Admin account:** Settings → **Admin · registration**
  - open/close registration (while open anyone can register; close it afterwards)
  - invite specific emails only (add to the allowlist; they can then register)
- **Read-only demo:** press **Try the demo** on the sign-in page to browse a demo
  account's sample data without an account; the database allows reading only. Only the
  owner knows the demo account's password (it is not in the repo).
  Change or switch off the demo account (Supabase SQL Editor):
  ```sql
  update private.app_config set demo_user_id = (select id from auth.users where email = 'demo account email');
  update private.app_config set demo_user_id = null;  -- demo off
  ```
  The demo account's data is readable by anyone; never put real data in it. Recreate
  the sample data with `scripts/seed-demo.ps1`.
- **Change password:** Settings → Account & database → **Change password** (asks for the current one).
- **Add an admin** (Supabase SQL Editor):
  ```sql
  insert into private.admins (user_id) select id from auth.users where email = 'someone@example.com';
  ```

### Cloud connection

| Field | Value |
|---|---|
| Supabase API URL | `https://jczyrhbgqvttqkhcahmk.supabase.co` |
| Publishable key | `sb_publishable_MjgDfM3Q2eeLOdDlvrggAQ_4qH6OKn3` |

The site has this connection built in; normally nothing needs to be entered. The
publishable key is meant for browsers and is public; **never paste the secret key or the
database password into the site or the repo**. Supabase dashboard:
https://supabase.com/dashboard/project/jczyrhbgqvttqkhcahmk

### Free plan notes

- A project idle for about 7 days is paused. The **Keep Supabase awake** workflow calls
  it every 3 days (GitHub disables schedules in repos without commits for 60 days;
  re-enable it under Actions). If it does get paused: **Restore project** in the Supabase
  dashboard; no data is lost.
- The free plan has no downloadable automatic backups: download a JSON backup from
  Settings regularly.

### Backup and restore

- **App backup:** Settings → Import & export → **Download JSON backup**.
  Restore: same page, *Restore from JSON backup* (inserts or updates by id; XP rules are
  replaced by the backup's).
- **Excel import:** same page, **Import from Excel** reads the original spreadsheet's
  Earning Log sheet; importing again only updates.
- Backups contain personal data; keep them outside the repo (`.gitignore` excludes
  `flying-blue-backup-*.json` and `*.xlsx`).

### Self-hosting with your own Supabase (for other people)

Anyone who wants to use the tool should create their own free Supabase project: the
data then belongs to them alone, and the owner of this site cannot see it. Two options:
**A** replace only the database and keep using this site; **B** host the site too (fork).

**Step 1 · Create the database (both A and B)**

1. Sign up at https://supabase.com, **New project** (free plan is fine; pick a nearby
   region, e.g. Frankfurt or Tokyo).
2. In **SQL Editor**, paste and run the 7 files in [`supabase/migrations/`](supabase/migrations/)
   one by one in file-name order (`000100` → `000700`). `000400_seed_airports.sql` is the
   airport data, about 500 KB; pasting and running it takes a moment.
   Do **not** run `supabase/seed.sql` (local development only).
   With Node.js installed you can use the CLI instead: `npx supabase link --project-ref <ref>`,
   then `npx supabase db push`.
3. Allow yourself to register (registration is closed by default), in SQL Editor:
   ```sql
   insert into private.signup_allowlist (email) values ('your email');
   ```
4. **Authentication → URL Configuration:** add the site's confirmation page to Redirect URLs
   (option A: `https://raistlinwolf.github.io/FlyingBlue/auth/confirm/`; option B:
   `https://<your account>.github.io/<repo name>/auth/confirm/`) so the sign-up
   confirmation link leads back to the site.
5. **Project Settings → API Keys:** note the Project URL (`https://xxxx.supabase.co`) and
   the **Publishable key** (`sb_publishable_…`).
   **Never give anyone the secret (service-role) key or the database password, and never paste them into the site.**

**Option A · Keep using this site (simplest, nothing to install)**

1. Open `https://raistlinwolf.github.io/FlyingBlue/connect/`, paste your URL and
   Publishable key, press **Connect**.
2. Back on the sign-in page → **Create an account** with the email allowed in step 1.3,
   confirm it from your inbox, then sign in.
3. Other devices: Settings → **Account & database** copies a connection link; open it on
   the phone (the connection is stored per browser).
4. Note: this site's code is still maintained and deployed by its author. For full
   control of the code, use option B.

**Option B · Fork the whole project onto your own GitHub Pages**

1. **Fork** this repo to your GitHub account.
2. In the fork: **Settings → Secrets and variables → Actions → Variables**, add two
   *variables* (not secrets): `SUPABASE_URL` = your Project URL,
   `SUPABASE_PUBLISHABLE_KEY` = your Publishable key.
   **Without them the build falls back to this repo's built-in Supabase project**, so the
   site would point at someone else's database and not work for you.
3. **Settings → Pages → Build and deployment → Source:** **GitHub Actions**.
4. **Actions** tab: enable workflows (forks start disabled), run **Deploy XP Tracker to
   GitHub Pages** → *Run workflow*. If the repo is not named `FlyingBlue`, first change
   `NEXT_PUBLIC_BASE_PATH: /FlyingBlue` in `.github/workflows/deploy-pages.yml` to `/<your repo name>`.
5. Open `https://<your account>.github.io/<repo name>/`, register and sign in.
6. The **Keep Supabase awake** workflow uses the same two variables and calls the project
   every 3 days so a free project is not paused.

**Afterwards (both A and B)**

- Make yourself an admin (to open/close registration and invite emails in Settings):
  ```sql
  insert into private.admins (user_id) select id from auth.users where email = 'your email';
  ```
- Option A has no keep-alive: the project is paused after about 7 idle days; press
  **Restore project** in Supabase; no data is lost.
- **Try the demo** on the sign-in page is empty on a new database. To offer a read-only
  demo, create a demo account with sample data, then run
  `update private.app_config set demo_user_id = (select id from auth.users where email = 'demo account email');`
  (the demo account's data is readable by anyone; never put real data in it).
- Download a JSON backup from Settings regularly; the free plan has no downloadable automatic backups.

### Features

- **Quick entry:** the **+** (bottom right / bottom bar) → add booking, flight, XP,
  refund/compensation. Multi-segment bookings chain automatically (after AMS → CPH the
  next segment starts at CPH) and reuse date, airline and cabin; expected XP is estimated
  from the XP rules. "Add return legs" adds the way back in one tap.
- **Expected vs actual XP:** each flight or XP transaction counts as either *credited*
  or *booked*, never both. "✓ Flown" moves a flight to credited.
- **Dashboard:** calendar year **or** qualification cycle (QC, with XP carried over from the previous cycle).
  - XP by source (flights, SAF, credit card, promotion, Choice Benefits, other);
    credited / booked / projected XP against the target.
  - Spending: gross, refunds, net, incremental, and cost per XP.
  - **QC XP-counter bar chart:** Explorer/Silver/Gold start a new QC the month after
    reaching the target, carrying the surplus over; Platinum deducts 300 XP at the end
    of the 12-month QC and carries the rest over.
  - Monthly table (credited, booked, QC counter, segments, spending).
- **Calendar:** monthly trips with routing, flight count, XP and trip name; tap a day for its details.
- **History:** filter by period, category, airline, origin, destination, XP source,
  status; search airports, flight numbers, names and references; archive/restore.
- **XP calculator:** great-circle distance from airport coordinates with editable XP
  rules; "Save as booking" stores it as a booking.
- **Excel import:** reads the original spreadsheet's Earning Log sheet, groups flights
  into bookings, splits SAF / credit-card / partner XP and rebuilds qualification cycles
  and carried-over XP by Flying Blue rules (a new cycle starts the month after reaching
  the next level). Importing again only updates.
- **Read-only demo:** **Try the demo** on the sign-in page shows sample data without an account.
- **Settings:** preferences (home airport, default airline / cabin / category, currency,
  status, target, theme), qualification cycles, XP rules, exchange rates, import/export,
  database connection, change password, connection link for other devices; admins also
  get the registration switch and invite list.
- **Cancel** on every Add screen (booking / flight / XP / credit) returns to the dashboard.
- **PWA:** installable on phone or desktop (standalone window), dark mode, offline fallback page.

### Data rules worth knowing

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

### Security model

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

### Project layout

```
src/app/            routes (static pages; each renders a client "screen")
src/components/     UI: screens, forms, dashboard, calendar, history, settings, navigation
src/domain/         pure business logic (XP buckets, costs, periods, calculator, Excel
                    import, CSV) — unit tested
src/lib/store/      database reads/writes from the browser (Supabase client + RLS)
src/lib/supabase/   client with runtime connection settings
supabase/           config.toml, migrations/, seed.sql (local only)
scripts/            airport seed and icon generators, Windows export fix, demo data (seed-demo.ps1)
tests/domain/       calculation and import tests
tests/db/           applies every migration to embedded Postgres and checks RLS
.github/workflows/  (repo root) build + deploy to GitHub Pages, keep-alive
```

### Local development

Requirements: Node.js 20.9+ (24 LTS recommended) and Docker Desktop. On Windows, if you
see `'npx' is not recognized`, run `winget install OpenJS.NodeJS.LTS` first.

```bash
cd 20260927
npm install
npx supabase start          # local Postgres, Auth, API on 127.0.0.1:54321; applies migrations + seed.sql
cp .env.example .env.local  # paste the publishable key from `npx supabase status`
npm run dev                 # http://localhost:3000
npx supabase stop           # stop (data kept); do not use db reset, it wipes everything
```

- `supabase/seed.sql` allow-lists `dev@example.com` locally (no email confirmation
  locally; pick any password when you register it).
- Local default publishable key: `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`
  (identical on every machine, not a secret).
- Full local database backup (Docker only):
  `docker exec supabase_db_flying-blue-xp-tracker pg_dump -U postgres --data-only --schema=public --schema=auth --schema=private postgres > backup.sql`

```bash
npm test           # calculations, Excel import, migrations + RLS (no Supabase needed)
npm run lint
npm run typecheck
npm run build      # static export into out/
```

### Deploying to GitHub Pages

1. Push to `main` (changes under `20260927/**`). The workflow
   `.github/workflows/deploy-pages.yml` (repository root) runs the tests and lint, builds
   with `NEXT_PUBLIC_BASE_PATH=/FlyingBlue` and publishes `out/`.
2. One-time: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   Re-run the workflow if the first run happened before this was switched.
3. The build uses repository variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`,
   falling back to the built-in cloud project. Users can still switch to another
   database on the Connect screen (stored in that browser only).

### Regenerating assets

```bash
npm run db:seed-airports   # rebuilds the airports migration from ../Draft/airports.js
npm run icons              # rebuilds PNG icons from public/icon.svg
```
