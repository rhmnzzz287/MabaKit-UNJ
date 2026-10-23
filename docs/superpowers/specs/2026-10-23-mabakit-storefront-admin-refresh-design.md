# MabaKit: storefront refresh and manageable admin

Status: proposed comprehensive plan, not approved for implementation.
Source: owner request, 2026-10-23. Extends business v2 and portals/team permissions specs. Existing security rules remain binding.

## 1. Scope and intended result

Refresh every existing customer, authentication, team and admin screen, not only home. Improve product discovery and operating workflows while preserving working checkout, snapshots, ownership, white-bag exclusion and portal separation.

Owner requirements:
- Benchmark https://www.g2g.com/id and relevant commerce experiences; retain MabaKit identity rather than clone another brand.
- Spacing based on 8px multiples.
- Admin navigation opens distinct sections/pages, not a long all-sections document.
- Catalog photos added only through upload, maximum five per catalog product.
- Admin exports sales history.
- Numeric percentage discounts support decimals.
- Diagnose staff inability to progress orders and stale `Masuk` after login.
- This delivery is documentation only.

## 2. Evidence and boundaries

Current code has manual `imagePath` fields in `frontend/src/pages/AdminPage.tsx` and accepts paths in `backend/src/admin-catalog.ts`. No media storage binding exists in `backend/wrangler.jsonc`. Uploads therefore require durable storage design, not a file input alone.

`frontend/src/lib/workspace.ts` maintains independent hook state. Stale header authentication is a hypothesis to reproduce, not a proven root cause. Staff routes already enforce operator cookies and permissions; do not remove guards to make fulfillment work.

Live G2G retrieval was attempted but yielded no inspectable page in this environment. No claim of visual inspection or measured benchmark results. Before visual implementation, capture accessible reference screenshots or request owner screenshots, recording viewport/date and observed patterns.

## 3. Approaches and recommendation

1. Cosmetic CSS refresh: smallest change, but leaves admin complexity and data workflows unresolved. Not recommended.
2. Cohesive commerce refresh plus routed admin, retaining React/Vite/Tailwind and Worker/D1: recommended. Shared primitives unify all pages; focused backend changes cover media, discounts and export.
3. Full frontend/platform replacement: more migration risk without demonstrated benefit. Reject.

Recommendation remains a proposal pending owner approval. No new UI framework, state library, payment provider or image service by default.

## 4. Visual direction

Proposed direction: product-led campus commerce, energetic storefront with quieter operational dashboards. Storefront ENERGY 2 / RHYTHM 3 / MOTION 1; admin/team ENERGY 1 / RHYTHM 1 / MOTION 1.

Retain MabaKit green for brand continuity; use dark ink and neutral surfaces for legibility, a restrained warm accent for actual savings. Do not use faculty colors as random interface decoration. Real catalog photography supplies color and identity.

Benchmark study should compare G2G discovery/navigation and one relevant physical-goods shop for galleries, cart and checkout. Borrow useful patterns such as prominent discovery, compact product comparison and visible purchase totals. Exclude gaming-marketplace mechanics, fake urgency, invented sales counts and fake trust badges.

Design tokens:
- Spacing: 0, 8, 16, 24, 32, 40, 48, 64, 80, 96px. Compact controls may use 8px inner spacing; page sections vary deliberately.
- Borders 1px and type sizes are not spacing and need not be multiples of eight.
- Inputs/buttons minimum 48px height; normal form text at least 16px.
- Mobile page gutters 16px; wider screens 24/32px; responsive content widths chosen by screen purpose.
- Consistent type hierarchy, visible focus, restrained elevation for overlays only.
- WCAG AA, 360px minimum, 200% zoom, reduced-motion support. Wide tables scroll inside their own region, not whole page.

Before implementation, review representative home, catalog, product, admin overview and team-order mockups. No invented logos, people or promotional assets.

## 5. Complete screen coverage

| Surface | Planned treatment |
|---|---|
| Shared shell | Responsive header/navigation, cart count, account state, footer, mobile menu, focus/skip link |
| Home | Real product-led feature area, faculty discovery, package-first browsing, clear single-product access |
| Catalog | Search/filter/sort scoped to actual catalog, package/product distinction, consistent price and stock hierarchy |
| Product | Gallery up to five photos, variant selection, actual discount, availability, clear add-to-cart |
| Package customize | Faculty-specific photos/components, confirmed changes, quote total, stock and savings |
| Cart | Clear configuration lines, editable quantity, safe faculty-edit flow, final price summary |
| Checkout | Account contact, verified quote, pickup information and payment method hierarchy |
| Payment/order/invoice | Transaction disclosures, readable timeline, snapshot totals, print-safe invoice |
| Login/register/profile | Consistent portal-specific forms, validation, existing-session behavior |
| About/contact/legal | Same typography/grid/navigation; honest existing content, no fabricated claims |
| Team dashboard/list/detail | Queue-first layout, filters, packing details, explicit status actions and feedback |
| Admin | Separate routed workspaces with focused forms/tables and persistent active navigation |

Every screen includes loading, empty, error, validation, disabled and success states where applicable. Inventory every existing control and route before work; record before/after verification so old screens are not left behind.

## 6. Admin navigation and pages

Use real URLs and links, with browser back/forward, refresh and deep links:
- `/admin/overview`: Ringkasan, period, sales KPI, current queues and staff activity.
- `/admin/orders`: searchable/filterable history, read-only order detail and export. Admin still cannot fulfill.
- `/admin/catalog`: product list, product creation/editing, variants, gallery, discounts.
- `/admin/packages`: per-faculty configuration, draft/publish, prices/components.
- `/admin/faculties`: mapping and aliases.
- `/admin/stock`: inventory and reserved counts.
- `/admin/pickup`: checkout availability and pickup instructions.
- `/admin/team`: staff provisioning, permissions, disable and session revocation.
- `/admin/audit`: audit history.

`/admin` redirects to overview. Sidebar active item follows URL; mobile navigation remains accessible. Load only data needed by active page. Unsaved form changes warn before navigation. Preserve list filters in query parameters, never secrets.

## 7. Upload-only gallery

Proposed storage: private-write R2 object storage accessed through Worker; D1 stores product association, object key, verified type/size/dimensions, order, alt text and timestamps. Provisioning storage/resources requires separate owner permission. Do not store binary/base64 photos in D1, localStorage, Git or ephemeral Worker filesystem.

Proposed constraints, pending approval:
- Maximum five attached photos per product including migrated current cover. Variant photos reference these product-owned photos; no extra five-per-variant loophole.
- JPEG, PNG and WebP only; reject SVG, animated files and mismatched byte signatures.
- Maximum 5 MiB per file and 20 megapixels; exact limits visible before upload.
- Inspect dimensions/type on server using a supported verified decoder; research Workers capability before selecting minimal dependency. Client checks alone are insufficient.
- No URL/path text inputs. APIs reject arbitrary imagePath and `attributes.foto`/`foto480` changes; clients reference server-issued media IDs only.
- Existing bundled images migrate as trusted legacy gallery entries; no destructive reimport or loss of catalog image quality.

Admin selects files, sees local previews and upload progress, edits alt text, chooses cover, reorders and removes. Keyboard buttons accompany drag sorting. Sixth photo rejected by UI and server, including concurrent uploads. Enforce capacity atomically through D1 reservation slots; failed uploads release reservations. R2 and D1 are not one transaction: finalize only after object succeeds, use safe retry and orphan cleanup. Failed upload never replaces working cover.

Authorize every upload/finalize/delete as admin with operator CSRF and Origin checks. Random server object keys, no raw filenames as paths. Serve verified raster types with `nosniff`, bounded cache policy and versioned keys; no executable content. Deleting product media cannot break order snapshots. Never upscale originals or distort aspect ratio; responsive derivatives require an approved processing path. No fake srcset widths.

## 8. Percentage discounts

Owner input: `25` means 25%, `12.5` means 12.5%. Proposed precision: two decimal places; 0 disables, valid range 0..100 inclusive. Accept decimal comma deliberately in localized input, normalize once, reject negative, NaN, infinity, excessive precision and values above 100. Show `%` suffix and live before/after preview.

Store integer basis points: 25% = 2500, 12.50% = 1250. Never store currency calculations as floating-point fractions. Proposed discount applies to all variants of a single product; packages use their explicit faculty prices and do not inherit component discounts automatically. Package discounts are out of scope unless owner requests them.

Compute final unit rupiah server-side, rounded half-up to nearest rupiah, then multiply by quantity. Define basePriceRp, discountBasisPoints and finalPriceRp consistently in catalog/quote/cart/admin/export. Example Rp35,000 at 12.5% becomes Rp30,625. Owner approved discounts up to 100%, including free products. Support zero-priced order lines and zero-total checkout explicitly: migrate positive-price constraints where needed, preserve positive base prices, and reject negative totals. A zero-total order requires no payment method or simulated payment action; create its PAID order, zero-value invoice and stock allocation atomically and idempotently, then continue normal staff fulfillment. Show `Gratis` and explain that no payment is required. Zero-value orders count as orders, contribute Rp0 to revenue, and remain included in sales exports. Test mixed paid/free carts, all-free carts, stock limits, replay and unchanged historical snapshots.

Order items snapshot original price, percentage and charged unit price. Existing orders/invoices remain unchanged when promotions change. Checkout requote and idempotency include current effective price/version. No double-discounting bundles; savings compares like-for-like totals. Show struck-through base price only when actual reduction exists. Audit discount changes without PII.

## 9. Sales history export

Proposed first format: UTF-8 CSV compatible with Excel, admin-only authenticated download. Default sales definition: PAID orders, filtered by `paid_at`, WIB inclusive start and exclusive next-day end. Cancelled/expired/pending are not sales. Include export time, filter context, order/invoice numbers, timestamps, payment/fulfillment status, quantity, original amount, discount and actual paid amount. One row per order with clearly defined totals; item-detail export can be separate later.

Do not include passwords, tokens, raw audit metadata or customer contact details by default. Escape CSV correctly and neutralize spreadsheet formula injection for cells beginning with `=`, `+`, `-`, `@`, tab or CR. Admin exports >50 orders using stable keyset pagination, never silently truncate. Stream bounded chunks or set an explicit tested maximum with an error; no unbounded all-rows memory load. Rate-limit and audit exports; `no-store`, attachment filename and correct MIME type. No public download link. Test consistency if rows change during export, using export cutoff and documented snapshot semantics.

## 10. Diagnose and fix reported workflows

### Staff cannot progress orders

Reproduce using fresh staff account, operator login, a buyer-created PAID/UNFULFILLED order and browser interaction. Capture exact request/status/CSRF cookie names and permissions without secrets. Check portal initialization, session rotation, operator headers, `orders.view` dependency, role gating, disabled accounts, route matching and stale UI.

Expected flow: authorized staff marks READY then confirms PICKED_UP. One event per transition, idempotent replay, no repeated stock consumption. Admin remains read-only for fulfillment. Missing permission yields actionable message, not a dead button; stale permission/session response refreshes gate and offers operator login. Do not grant broad admin rights or bypass guards to resolve symptom.

### Masuk remains after login

Reproduce login/logout, route changes, refresh, expired session, simultaneous buyer/operator sessions and cross-tab changes. Evaluate independent `useWorkspace` hook state as suspected cause. Use one portal-scoped shared auth snapshot/subscription, explicit invalidation after login/logout and server revalidation on focus. Server remains authority; never treat localStorage role as proof.

Header displays loading state until known, then correct buyer account links instead of Masuk. Buyer login page redirects an already authenticated buyer to safe next; operator login redirects authenticated operator to role-safe destination. Operator session alone must not masquerade as buyer login. If owner wants operator header status on storefront, show separate operator indicator, not false buyer authentication. Logout clears only affected portal state and cached private data.

## 11. Implementation sequence and checkpoints

1. Baseline: capture screens/routes, reproduce both reported bugs, run existing tests; collect actual benchmark screenshots.
2. Resolve open decisions below and approve representative layouts. Sync PRD/SCHEMA/DESIGN/RELEASE with accepted contract.
3. Fix auth-state and staff workflow regressions first, add failing reproduction tests then minimal fixes.
4. Introduce 8px spacing and shared visual primitives; migrate all customer/auth/team screens in route groups.
5. Split admin routes and focused sections, preserving authorization and forms.
6. Add media schema/storage API and upload gallery, migrate existing photos, test failures/concurrency.
7. Add discount schema, server pricing/snapshots and admin input; verify checkout/invoice consistency.
8. Add secured CSV export with filters and tested pagination/escaping.
9. Full regression/security review, browser accessibility/mobile checks, update release evidence and owner walkthrough.

Likely code areas: `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/src/components/ui.tsx`, `frontend/src/lib/{api,workspace,types,cart}.ts`, all existing `frontend/src/pages/*`; split `AdminPage.tsx` into focused route modules only where needed. Backend: `backend/src/{index,http,auth,session,pages,admin,admin-catalog,catalog,checkout,orders}.ts`, new bounded media/export handlers, versioned migrations after `0010`, Wrangler bindings and tests. Avoid unrelated asset/source churn.

No production deployment, new paid resource, destructive migration or dependency installation without authorization. Document local R2 simulation separately from remote setup.

## 12. Acceptance and release checks

- All existing routes and shared elements use approved visual system; spacing audit finds no ad-hoc layout gaps outside documented exceptions.
- Browser evidence at 360/768/1280px, 200% zoom, keyboard-only and reduced motion; AA contrast; no page-level overflow.
- Admin navigation changes URL, renders only selected workspace, survives refresh/back; every action has feedback.
- Buyer/admin credentials rejected in wrong portals; two portal sessions coexist; no stale Masuk or repeated login after successful matching-portal login.
- Browser staff fulfillment succeeds end-to-end; missing/revoked permissions and admin fulfillment are rejected server-side.
- Five-photo limit survives parallel requests; forged MIME, oversize, unauthorized upload/delete, failed finalize and orphan cleanup tested.
- Decimal discounts produce same integer totals in product/cart/checkout/order/invoice/export; changed prices require confirmation; old snapshots unchanged.
- Export handles commas/quotes/newlines/Unicode/formulas, >50 orders, boundary dates and unauthorized access without leaking PII.
- White bags remain unsellable through UI, direct APIs and package publishing.
- Existing tests plus new regression tests, typecheck and build pass. Record actual commands/results; do not mark manual/staging checks complete without evidence.

## 13. Decisions for owner

1. Approve product-led light storefront with retained green identity, rather than copying G2G branding.
2. Approve R2-backed upload storage, five photos per product, proposed 5 MiB/20MP limits; remote provisioning requires separate permission.
3. Owner approved 100% discounts on 2026-10-23, allowing free products. Proposed scope remains single products/all variants, precision two decimals; zero-total checkout behavior is specified in section 8.
4. CSV order-level PAID sales export with no customer contacts by default; confirm if another format is essential.

These are proposals, not recorded approvals. No application implementation performed for this request.
