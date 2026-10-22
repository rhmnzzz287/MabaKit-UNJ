# Rencana implementasi MabaKit: rilis pertama

Revisi: 22 Oktober 2026. Rencana tugas kecil dari [docs/PRD.md](docs/PRD.md) dan [docs/SCHEMA.md](docs/SCHEMA.md), sesuai alur kerja [AGENT.md](AGENT.md). Setiap tugas selesai hanya setelah test yang dijalankan lolos dan hasilnya dicatat di bawah. Keputusan D01-D08 BRD belum ada: bagian yang membutuhkannya tetap diblokir, bukan dikodekan dengan tebakan. Bagian sandbox boleh lanjut dengan data SIMULASI.

Status tugas: `[ ]` belum, `[x]` selesai dengan bukti. Terkini: `git log` 07bd3e1 (baseline docs) dan 4f29705 (scaffold); `npm run typecheck` exit 0, `npx vitest run` 1 passed, `npm run build` exit 0 pada 22 Oktober 2026.

## Fase 1: fondasi repo

- [x] T1. Git init, baseline commit (docs + AGENT.md + rencana ini), CI minimal (typecheck + test exit 0). Bukti: log commit dan job CI.
- [x] T2. Scaffold Vite React TS + Tailwind, path alias, ESLint/Prettier. Bukti: `npm run build` exit 0.

## Fase 2: kontrak database

- [ ] T3. Migrasi tabel inti dari SCHEMA §2: profiles, user_roles, faculties, departments, spec_checklists, products, variants, bundle_components, orders, order_items, order_components, payments, pickup_tickets, refunds, audit_logs, store_settings, constraint dan index. Bukti: supabase `db reset` sukses, tabel/trigger sesuai.
- [ ] T4. Uji concurrency dari RELEASE T04-T06, T09-T12: checkout race SKU terakhir, alokasi HELD/CONSUMED/RELEASED, refund, adjust_stock. Bukti: hasil pgTAP/testDB, invariant terpenuhi.

## Fase 3: service dan endpoint

- [ ] T5. RPC reliabel dari SCHEMA §3 (checkout, payment, pickup, refund, stock). Bukti: test hasil dari database nyata.
- [ ] T6. Edge create-payment, payment-webhook, reconcile-payments dari PRD §4 dan DESIGN §1 dengan signature/amount/rate limit. Bukti: test server lokal menyentuh snapshot/status guard.

- [ ] T7. Seed simulasi (produk, varian, paket, fakultas, checklist) berlabel SIMULASI. Bukti: query data katalog tampil sesuai.

## Fase 4: UI

- [ ] T8. Rute publik dari DESIGN §4: home katalog, detail produk, keranjang lokal, login OTP. Bukti: test render + state kosong/error.
- [ ] T9. Checkout, Snap modal, orders list/detail dengan status bersama. Bukti: test render + poll/pulih dari server.
- [ ] T10. Staff orders + pickup claim + admin (katalog/stok/pause checkout/refund/audit/MFA). Bukti: test render + aksi memerlukan role.

- [ ] T11. Aksesibilitas dan kontras dari DESIGN §3 §5. Bukti: audit contrast terukur, keyboard pass, status non-warna, mobile 360px.

## Fase 5: gerbang rilis

- [ ] T12. Jalankan checklist RELEASE §2 §3 §4 uji wajib. Bukti: tabel `ID | tanggal | environment | penanggung jawab | perintah | hasil | lokasi` untuk tiap ID.

- [ ] T13. Operasi go-live RELEASE §5 butuh D01-D08 lengkap; blokir sampai pemilik mengisi.
