# MabaKit Customer and Team Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat demo belanja MabaKit terhubung dari beranda hingga pesanan diterima dan diulas, dengan dashboard pembeli sederhana dan dashboard operasional tim.

**Architecture:** Pertahankan React/Vite, API same-origin Cloudflare Worker, dan D1. Gunakan identitas sesi yang ada, snapshot pesanan immutable, serta transisi pembayaran dan fulfillment yang dijaga server. Pembayaran dan email hanya simulasi; WhatsApp hanya membuka draft pesan manual.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Cloudflare Workers/D1, Vitest; tanpa dependency baru kecuali kebutuhan yang dibuktikan dan disetujui.

**Spec:** `docs/superpowers/specs/2026-10-22-mabakit-customer-team-design.md` (proposal, perlu persetujuan sebelum implementasi). Baca juga `AGENT.md`, `docs/PRD.md`, `docs/SCHEMA.md`, `docs/DESIGN.md`, `docs/RELEASE.md`.

## Global Constraints

- QR, scanner kamera, QR pickup dan checklist berbasis QR tidak masuk scope.
- Tidak ada gateway, pengiriman email, WhatsApp otomatis, akun produksi, booking atau slot pickup.
- Tidak membuat klaim afiliasi resmi UNJ, testimoni nyata, omzet nyata, atau email berhasil terkirim.
- Label simulasi pada pembayaran, invoice, ringkasan penjualan dan preview email; hindari banner demo berulang di semua halaman.
- Contoh ulasan selalu berlabel; nama fiktif tidak dianggap pembeli nyata.
- Data kontak tersimpan di D1, bukan localStorage; akses pesanan/profil diperiksa server.
- Mobile mulai 360px, zoom 200%, target sentuh 48px, keyboard/focus, WCAG AA, reduced motion, serta loading/empty/error/retry.
- Pertahankan pengamanan stok, idempotensi pembayaran, invoice unik dan snapshot pembelian.
- Tidak deploy, mengaktifkan layanan eksternal, menambah biaya atau mereset DB tanpa izin.
- Perubahan gambar katalog yang sudah ada berada di luar commit fitur ini; jangan menimpa atau ikut commit tanpa pemeriksaan.

## Review Focus

1. Sesi lain menebak ID profil/order/invoice/review: akses tetap ditolak; test Task 1/3/5.
2. Pembayaran atau konfirmasi penerimaan terkirim ganda: stok, invoice, status dan audit tidak terduplikasi; test Task 3/4.
3. Penjualan lebih dari 50 pesanan dan lintas tengah malam WIB: agregat tidak bergantung pagination; test Task 4.
4. Kontak berubah setelah checkout: snapshot invoice/order lama tetap sama; test Task 1/3.
5. Carousel, jaringan putus dan sesi kedaluwarsa: kontrol dapat digunakan tanpa gerakan otomatis, tidak ada keberhasilan palsu; test Task 2/3/6.

## Urutan dan batas tugas

Enam tugas, berurutan. Semua keputusan di bawah merupakan proposal teknis sampai desain disetujui. Commit hanya perubahan milik tugas, bukan `git add .`.

### Task 1: Profil dan akses workspace

**Files:** Create `backend/db/migrations/0002_customer_experience.sql`, `backend/src/profile.ts`, `backend/src/profile.test.ts`, `frontend/src/pages/ProfilePage.tsx`; modify `backend/src/session.ts`, `backend/src/index.ts`, `frontend/src/lib/types.ts`, `frontend/src/App.tsx`, `backend/db/seed.sql`, `docs/PRD.md`, `docs/SCHEMA.md`.

**Interfaces:** `GET /api/profile` -> `{profile:{name:string, whatsapp:string, email:string}|null}`; `PATCH /api/profile` consumes same fields. `GET /api/demo/session` adds `role:'buyer'|'staff'|'admin'`. `POST /api/demo/operator/logout` revokes operator privilege without replacing buyer session. Existing operator login still requires server-verified code.

- [ ] Write tests `profileOwnership`, `rejectInvalidContact`, `profileDoesNotRewriteOrders`, `operatorNeedsValidCode`, `logoutPreservesBuyerOrders`; assert unknown fields/oversized bodies rejected, name 1–80 chars, normalized Indonesian WhatsApp, email max 254 chars, another session cannot read profile.
- [ ] Run `npm run test:backend -- backend/src/profile.test.ts`; new cases fail before feature exists.
- [ ] Add session-owned profile row, validation at API boundary, CSRF-protected PATCH/logout, session role response and `/profile` form. No production login promises. Profile defaults survive page reload during current session, not across devices.
- [ ] Add explicit local fixture command in `package.json` only if needed for sample orders. Keep fixture setup idempotent and non-destructive; never seed raw session secrets into committed SQL. Provide buyer/team entry controls; team access uses operator code, never frontend role toggle as authorization.
- [ ] Run targeted tests and typecheck; update schema/auth contract and commit touched files as `feat: add buyer profile and protected workspaces`.

### Task 2: Beranda dan katalog terpisah

**Files:** Create `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/HomePage.test.tsx`; modify `frontend/src/App.tsx`, `frontend/src/pages/CatalogPage.tsx`, `frontend/src/pages/ProductPage.tsx`, `frontend/src/App.test.tsx`, `docs/DESIGN.md`.

**Interfaces:** `/` -> HomePage; `/catalog` -> existing catalog; `/products/:id` retained. Consume existing `GET /api/catalog`; featured list is approved fixed product IDs, filtered against available catalog, not fabricated best-seller rankings.

- [ ] Write tests `homeLinksToCatalog`, `carouselKeyboardAndPause`, `carouselReducedMotion`, `catalogFailureRetry`; assert usable previous/next controls, active slide links correct product, no autoplay with reduced motion, focus/hover pauses autoplay, unavailable featured products omitted.
- [ ] Run `npm run test:frontend`; new cases fail.
- [ ] Build homepage with hero copy from design, actual product photos, featured carousel, three-step buying/pickup explanation and labeled example reviews. Autoplay interval 6000ms with visible pause control; zero/one slide disables autoplay and redundant controls. Do not create illustration assets or replace existing brand direction without approval.
- [ ] Move catalog route, fix navigation/breadcrumb links, use bounded image dimensions and lazy loading below fold. Include fallback for failed image and empty catalog; no invented scarcity or metrics.
- [ ] Run frontend tests; inspect 360px/desktop, 200% zoom, keyboard and reduced motion. Commit as `feat: add MabaKit homepage and featured products`.

### Task 3: Checkout, progres dan simulasi invoice email

**Files:** Modify `backend/src/domain/checkout.ts`, `backend/src/domain/checkout.test.ts`, `backend/src/checkout.ts`, `backend/src/orders.ts`, `backend/src/index.ts`, `frontend/src/lib/cart.ts`, `frontend/src/lib/types.ts`, `frontend/src/pages/CheckoutPage.tsx`, `frontend/src/pages/OrdersPage.tsx`, `frontend/src/pages/InvoicePage.tsx`; create `frontend/src/pages/OrderTracking.test.tsx`, `backend/src/order-experience.test.ts`.

**Interfaces:** Checkout accepts buyerName, contactPhone, email instead of separate recipient input. Retain internal recipient snapshot as buyerName for old schema compatibility. Order response adds email snapshot and `review` eligibility. Owner-only `GET /api/orders/:id/email-preview` -> `{recipient:string, subject:string, invoiceUrl:string, simulated:true}`; only PAID invoice accessible. Existing order URLs retained.

- [ ] Write tests `checkoutContactSnapshot`, `profilePrefillCanBeEdited`, `invoicePreviewOwnership`, `pendingHasNoEmailPreview`, `trackingRefreshError`, `paymentReplayOneInvoice`; assert changed profile never changes placed order; preview says no email sent; pending/expired/paid/ready/picked-up map correctly.
- [ ] Run targeted frontend/backend tests and confirm new assertions fail.
- [ ] Persist immutable order email snapshot, update checkout validation/hash and profile prefill. Require valid email for new checkouts; legacy missing emails display unavailable, never fabricate address. Validate max body 32KB and reject unknown fields for changed endpoints.
- [ ] Build `/orders` list and `/orders/:id` timeline from existing timestamps. Labels: Menunggu pembayaran, Sedang disiapkan, Siap diambil, Sudah diterima; expired gets separate terminal state, not completed timeline. No shipping state. Add refresh control and refetch on focus; no claim of live push updates.
- [ ] Add invoice email preview after payment with “Simulasi email, tidak ada email dikirim”. Generate from invoice/order snapshot; do not store false delivery status or couple preview to stock/payment mutations.
- [ ] Run tests/typecheck; commit as `feat: connect checkout profile and order tracking`.

### Task 4: Dashboard penjualan dan operasional tim

**Files:** Create `backend/src/team.ts`, `backend/src/team.test.ts`, `frontend/src/pages/TeamDashboardPage.tsx`, `frontend/src/pages/TeamDashboardPage.test.tsx`; modify `backend/src/index.ts`, `backend/src/staff.ts`, `frontend/src/pages/StaffPage.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/types.ts`, `docs/SCHEMA.md`.

**Interfaces:** `/team` dashboard; `/team/orders` management; `/team/orders/:id` detail. Existing `/staff/orders`, `/staff/pickup` retained or redirected safely. Staff/admin-only `GET /api/team/summary?period=today|7d|30d|all`; `GET /api/team/orders?payment=...&fulfillment=...&cursor=...&limit=20` -> `{orders,nextCursor}`; `GET /api/team/orders/:id` includes item/component snapshots. `POST /api/team/orders/:id/complete` requires PAID+READY, mutation guard, explicit confirmation and audit.

- [ ] Write tests `teamDeniedToBuyer`, `salesAggregateBeyondPage`, `wibRangeBoundaries`, `pendingAndExpiredExcludedFromRevenue`, `completeOnlyReadyOnce`, `packingIncludesBundleComponents`, `whatsappDraftDoesNotMutate`; seed >50 orders and assert full SQL aggregate, not page sum.
- [ ] Run backend tests; new cases fail.
- [ ] Implement SQL summary for paid gross value, paid count, pending count, preparing count, ready count and completed count; no profit/net/refund claims. Date range uses order creation time for counts and paid_at for sales, Asia/Jakarta boundaries. Return period labels. Default today, empty period zero.
- [ ] Implement paginated order filters, detail/contact snapshots and component quantities. Keep existing UNFULFILLED/READY/PICKED_UP enums; no free-form status dropdown. Reuse READY guards; new manual complete action replaces QR dependency, verifies status, is idempotent and writes audit atomically with transition. Concurrent calls yield one completion event.
- [ ] Build dashboard, filtered list, detail and explicit confirmation dialog. “Sedang disiapkan” derives PAID+UNFULFILLED, not new PROCESSING enum. Staff cannot edit stock/settings unless authorized; link authorized admin to existing stock page.
- [ ] Add manual WhatsApp draft `https://wa.me/<digits>?text=<encoded message>` from normalized order snapshot. Message includes order number, current stage, pickup instructions when READY; never payment credentials/tokens. Preview destination and copy message option. Fixture contacts are synthetic; disable external send for fixtures. Opening draft never marks contacted or updates status.
- [ ] Run tests and keyboard checks; commit as `feat: add team sales and order operations`.

### Task 5: Ulasan setelah penerimaan

**Files:** Create `backend/src/reviews.ts`, `backend/src/reviews.test.ts`, `frontend/src/components/OrderReviewForm.tsx`, `frontend/src/components/OrderReviewForm.test.tsx`; modify migration from Task 1 only if not applied, otherwise create `backend/db/migrations/0003_order_reviews.sql`; modify `backend/src/index.ts`, `frontend/src/pages/OrdersPage.tsx`, `frontend/src/pages/HomePage.tsx`.

**Interfaces:** Owner-only `POST /api/orders/:id/review` consumes `{rating:number,comment:string}`; unique order-level review. Public `GET /api/reviews` returns at most 6 newest `{displayName,rating,comment,createdAt,isExample}` with no email/phone/order/session identifiers. Rating 1–5 integer; trimmed comment 10–1000 chars. No edit/delete UI in this phase.

- [ ] Write tests `reviewOnlyOwnerAfterPickup`, `reviewOnePerOrderConcurrent`, `ratingAndLengthBounds`, `publicReviewRedactsContacts`, `commentRenderedAsText`, `examplesAlwaysLabeled`; assert public name first word only, no full contact data, no arbitrary HTML execution.
- [ ] Run targeted tests; new cases fail.
- [ ] Add D1 constraints and server eligibility requiring PAID+PICKED_UP. Show review form only when eligible and not submitted; conflict displays existing review state. Use plain escaped text, never dangerouslySetInnerHTML.
- [ ] Add deterministic example reviews with fictional names and varied, explicit sample feedback; label each “Contoh ulasan”. Never call them honest actual customer feedback. User-submitted reviews in this app remain identified as trial reviews. Homepage failure does not block catalog CTA.
- [ ] Run backend/frontend tests; commit as `feat: add post-pickup order reviews`.

### Task 6: Alur demo, kontrak dan verifikasi menyeluruh

**Files:** Modify `docs/PRD.md`, `docs/SCHEMA.md`, `docs/DESIGN.md`, `docs/RELEASE.md`, `README.md`, `PLAN.md`; create `backend/src/customer-team-flow.test.ts`; extend `frontend/src/App.test.tsx`.

**Interfaces:** Preserve all APIs established above; document fixture command, team code setup, session expiry and exact simulation limits. Existing checkout holds stay 30 minutes and sessions one day unless separately approved.

- [ ] Add integration test `customerTeamFlow`: buyer profile -> checkout -> simulated payment -> invoice preview -> team READY -> manual complete -> buyer refresh -> review. Assert same order snapshots throughout and stock consumed once.
- [ ] Add `expiredSessionNoFalseSuccess`, `crossSessionOrderDenied`, `fixtureSetupIdempotent`, and route matching tests for nested order/team paths. Confirm profile recovery across browsers is not promised.
- [ ] Run `npm test && npm run typecheck && npm run build`; require all exit 0. Test actual D1 trigger/concurrency behavior locally, not mock-only; staging validation remains separate before deployment.
- [ ] Run manual two-workspace smoke test, preserve buyer session when switching view, verify buyer cannot invoke team APIs, verify team logout removes privileges. Test empty/large lists, bad contact, failed network, sold-out item and expired checkout.
- [ ] Inspect 360px, desktop, 200% zoom, keyboard, focus restoration, contrast and reduced motion. Record evidence and limitations in RELEASE; do not claim checks not performed.
- [ ] Update docs to explicitly replace prior direct-catalog homepage choice and refine simulation labeling without hiding payment/email limitations. Preserve production D01–D08 blocks. Request whole-diff code review; fix verified findings and rerun relevant checks.
- [ ] Commit task files as `test: verify customer and team demo journey`; no deploy or DB reset.

## Handoff

Design and proposed defaults need review before execution. Recommend native execution: six connected tasks share order/session contracts, so one writer avoids competing schema/API changes; independent reviewer checks final diff. Subagent-driven execution remains available with review per task. No implementation authorized by this document alone.
