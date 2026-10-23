# MabaKit storefront and admin refresh: implementation plan

Spec: `docs/superpowers/specs/2026-10-23-mabakit-storefront-admin-refresh-design.md`
Binding constraints: existing v2 security, portal separation, white-bag exclusion, order snapshots.

## Global constraints

- No new runtime dependency without measured need; use Web platform and Workers APIs.
- Every behavior change starts with a failing test.
- All prices integer rupiah; discounts stored basis points (10000 = 100%).
- Discounts 0..100% inclusive; 100% means free, zero-total checkout allowed.
- Upload gallery: max 5 product media, admin only, server-validated raster.
- Admin fulfillment stays read-only; staff needs `orders.ready` / `orders.complete`.
- Do not provision remote R2 or deploy without owner permission.
- Spacing multiples of 8px; controls 48px; AA contrast; 360px and 200% zoom.

## Task 1: portal auth snapshot and stale header

- Add `frontend/src/lib/auth-store.ts` with one `useSyncExternalStore` snapshot per portal, `refreshAuth(portal)`, `setAuth(portal, info)`, revalidate on focus/visibility and after login/logout.
- `useWorkspace` reads the store; `LoginPage` and `OperatorLoginPage` refresh then redirect; an already-authenticated matching portal redirects to safe next.
- Test: login refresh updates header without reload; buyer and operator states stay independent.

## Task 2: staff fulfillment regression

- Reproduce via API and UI test with fresh staff, PAID order and default permissions.
- Fix client gating only if server is correct; server stays authoritative.
- Tests: staff ready -> complete; replay idempotent; admin buttons absent; revoked permission gives message.

## Task 3: discounts and zero-total checkout

- Migration `0011_discounts_free_orders.sql`: `products.discount_basis_points`, order item base/effective snapshot columns, allow zero totals and unit prices, payment method `FREE`, rebuild constrained tables with deferred FKs.
- Catalog/product/quote/admin expose `basePriceRp`, `discountBasisPoints`, `finalPriceRp`; checkout computes effective prices server-side, snapshot base/discount/final.
- Zero-total: create PAID order + FREE payment + stock consumption + zero invoice atomically; no countdown/payment action; show `Gratis`.
- Tests: 12.5% rounding, 100%, mixed cart, free cart idempotent, old snapshots unchanged, total/revenue 0.

## Task 4: CSV export and admin KPI

- `GET /api/admin/export/orders.csv` admin-only, PAID by `paid_at`, WIB range, keyset pagination, formula-injection escaping, no contact details, audit, `no-store`.
- Admin summary adds per-staff READY/PICKED_UP counts from `audit_logs` in period.
- Tests: escaping, >50 rows, boundary, authorization, zero-total rows.

## Task 5: routed admin

- `/admin` redirects to `/admin/overview`; routes overview, orders, catalog, packages, faculties, stock, pickup, team, audit.
- Active nav follows URL, refresh/back works, only active section renders/fetches.
- Test: each link renders only its heading; `/admin` redirects.

## Task 6: upload gallery

- Migration `0012_product_media.sql`: product media rows with storage key or legacy path, faculty, position 0..4, alt, cover, unique capacity.
- Worker: admin multipart upload (JPEG/PNG/WebP signature + dimensions, 5 MiB, 20MP), R2 put, list/update/delete, public media serving with nosniff/cache. Legacy catalog photos become gallery entries.
- Admin form replaces imagePath text input with upload/preview/alt/cover/remove; max five incl. legacy.
- Tests: 6th rejected concurrently, forged type rejected, unauthorized rejected, delete keeps order snapshots.

## Task 7: visual system and screen refresh

- Spacing tokens and shared primitives; shell/nav/footer; home, catalog, product, customize, cart, checkout, payment/order/invoice, auth/profile, about/contact, team, admin.
- Loading/empty/error/disabled/success states; no dead controls; mobile menu; 48px targets.

## Task 8: verification and docs

- `npm test`, `npm run typecheck`, `npm run build`; local smoke; docs PRD/SCHEMA/DESIGN/RELEASE sync; record deferred items.
