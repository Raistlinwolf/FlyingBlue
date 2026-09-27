# Side project: Flying Blue XP Tracker

**Live:** https://raistlinwolf.github.io/FlyingBlue/ · **Code:** https://github.com/Raistlinwolf/FlyingBlue (`20260927/`)

A mobile-first web app (installable PWA) for planning and tracking status in Air
France-KLM's Flying Blue programme: flights, qualifying XP, spending and cost per XP,
qualification cycles, and imports from my original Excel tracker.

---

## CV entry (short)

**Flying Blue XP Tracker** — personal side project · 2026 · TypeScript, Next.js, React, Supabase (Postgres)
- Designed and shipped a mobile-first PWA that replaced my Excel-based frequent-flyer tracker:
  bookings with multi-segment itineraries, XP from flights/SAF/credit cards, refunds, spending
  and cost-per-XP dashboards, travel calendar and XP calculator.
- Modelled the domain relationally (bookings → segments, XP transactions, credits,
  qualification cycles) in Postgres with Row Level Security, composite foreign keys and
  versioned SQL migrations; business rules live in a pure, unit-tested TypeScript layer.
- Built an Excel importer that reconstructs trips and status-qualification cycles from raw
  logs; results matched my spreadsheet month by month.
- Deployed as a static site on GitHub Pages with a CI pipeline (tests, lint, build, deploy)
  and a hosted Supabase backend; 64 automated tests, including RLS isolation tests.
- Built with an AI coding agent (Claude Code): I wrote the product spec, made the product and
  architecture decisions, and reviewed and tested the result.

---

## Portfolio description (long)

### Problem
I tracked my Flying Blue status in a spreadsheet: one row per flight, manual XP
look-ups, and hand-maintained totals per qualification year. It mixed up planned and
flown XP, counted multi-leg tickets awkwardly, didn't follow the programme's
qualification cycles (which don't match calendar years), and was painful on a phone.

### What I built
- **Fast entry on mobile:** adding a multi-segment XP run takes seconds. Each new leg
  starts where the previous one ended, reuses date, airline and cabin, and pre-fills
  expected XP from a configurable XP chart using great-circle distance between airports.
- **Correct accounting:** each flight or XP item counts as either *credited* or
  *booked*, never both. Ticket prices count once per booking, not per segment. Refunds
  and compensation can be marked as reducing net cost. Foreign currencies are converted
  or flagged, never silently assumed to be EUR.
- **Qualification cycles:** a month-by-month XP counter models the programme's rules.
  Reaching the next level starts a new cycle the following month with the surplus
  carried over, and Platinum deducts 300 XP when its cycle ends. Charts compare credited,
  booked and target XP.
- **Excel import:** parses the original sheet in the browser, groups legs into tickets,
  separates SAF, credit-card and partner XP, and rebuilds past cycles. Re-importing is
  idempotent because record ids are derived from the row contents.
- **Operations:** JSON backup and restore, Excel-friendly CSV export, an admin-only
  registration switch, password change, and a scheduled keep-alive for the free
  database tier.

### Technical highlights
- **Architecture:** Next.js 16 static export on GitHub Pages; the browser talks directly
  to Supabase (Postgres + Auth). With no application server, security is enforced in the
  database: Row Level Security on every table, composite foreign keys so records can't be
  attached to another user's booking, and signup restricted by a database trigger.
  Admin actions run through permission-checked SQL functions.
- **Domain-driven core:** XP buckets, cost attribution, period filtering, the
  qualification-cycle counter, the XP calculator and the Excel import are pure TypeScript
  functions. The UI only renders their output.
- **Testing:** Vitest covers the financial and XP rules (for example, "a six-segment
  ticket is counted once" and "actual XP replaces expected XP"). The SQL migrations are
  applied to an embedded Postgres (PGlite) to test RLS isolation, the signup allowlist,
  the admin functions and constraints. Playwright end-to-end runs covered the live site.
- **Delivery:** a GitHub Actions pipeline runs tests, lint, build and deploy to Pages.
  Schema changes go through versioned migrations pushed with the Supabase CLI.
- **UX and accessibility:** responsive layout with a bottom navigation bar on mobile and a
  sidebar on desktop, light and dark themes, and chart colours validated for colour-vision
  deficiency. Charts are hand-built SVG with hover tooltips and table equivalents.

### Stack
TypeScript · React 19 · Next.js 16 (App Router, static export) · Tailwind CSS 4 ·
Supabase (PostgreSQL, Auth, RLS, SQL functions) · Zod · Vitest · PGlite · Playwright ·
GitHub Actions · GitHub Pages · PWA

### Scale
About 9,000 lines of TypeScript across 100 files, 6 SQL migrations, 64 automated tests
and a reference table of 6,000+ airports.

---

## 中文版（履歷用）

**Flying Blue XP Tracker**：個人專案，2026 年。使用 TypeScript、Next.js、React、Supabase（Postgres）
- 設計並上線一個以手機為主的 PWA，取代原本用 Excel 管理的常旅客紀錄。功能包括多段航班訂票、
  航班／SAF／信用卡 XP、退款、花費與每 XP 成本儀表板、行程行事曆與 XP 計算機。
- 以關聯式模型建構資料（訂票 → 航段、XP 交易、退款、資格週期）。在 Postgres 使用 Row Level
  Security、複合外鍵與版本化 SQL migration；商業規則放在可單元測試的純 TypeScript 層。
- 開發 Excel 匯入功能，從原始紀錄重建行程與會籍資格週期，逐月結果與原試算表一致。
- 以靜態網站部署於 GitHub Pages，搭配 CI 流程（測試、lint、建置、部署）與雲端 Supabase；
  共有 64 個自動化測試，包含資料隔離（RLS）測試。
- 與 AI 程式開發代理（Claude Code）協作完成：由我撰寫產品規格、決定產品與架構方向，
  並審查與測試成果。
