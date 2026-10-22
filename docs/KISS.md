# KISS: batas kompleksitas MabaKit

Revisi: 22 Oktober 2026. Batas ini mengikuti rollout usulan [BRD.md](BRD.md), bukan alasan mengurangi keamanan atau menghapus kebutuhan sumber.

Tujuan project adalah toko perlengkapan PKKMB: lihat produk, pilih satuan/paket, bayar dan ikuti pesanan sampai diserahkan. Booking/reservasi tidak membantu alur inti ini dan berada di luar produk maupun roadmap. Tidak membuat kalender, pilihan slot, kuota kunjungan, booking fee atau reschedule.

## Pilihan tetap rilis pertama

| Kebutuhan | Pilihan minimum | Tidak ditambah sekarang |
|---|---|---|
| Web | React + TypeScript + Vite + Tailwind CSS, SPA | Next.js/SSR tanpa kebutuhan SEO terukur, microfrontend, monorepo |
| State | React state/context seperlunya, cart localStorage | Zustand/Redux, sinkronisasi cloud cart, event bus |
| Data | Supabase SDK + RLS, PostgreSQL transactional RPC | REST wrapper Express/NestJS, ORM hanya untuk membungkus SDK |
| Uang | Midtrans Snap, satu attempt/reference per order | Xendit bersamaan, UI QRIS/kartu sendiri, engine payment multi-provider |
| Reliability | Tabel order/payment, status guards, scheduler satu menit dengan lease/retry | Kafka/RabbitMQ/Redis, microservices |
| Pickup | Informasi lokasi/jam layanan toko, kode acak, web staf terautentikasi, klaim atomik | Booking/reservasi, aplikasi native, kamera/QR wajib, pickup parsial |
| Notifikasi | Halaman order sebagai sumber utama, bantuan operasional | WA/PDF otomatis dan queue notifikasi sebelum dibutuhkan |
| Produk | Satuan dan paket tetap berkomponen SKU | Paket bersarang, builder khusus, diskon bertingkat/kustom sebelum aturan disetujui |
| Operasi | UI admin minimum, audit, backup teruji, pause checkout | Dashboard analitik rumit, multi-tenant/vendor |

## Yang tidak boleh disederhanakan

Harga dihitung server. Status lunas hanya berasal dari provider terverifikasi. Alokasi stok komponen dikunci atomik saat checkout; bukan reservasi pelanggan. Paket memakai stok komponen. Role tidak dapat diedit pelanggan. Uang/data pembeli tidak hilang karena timeout atau callback browser. Refund dan pickup diaudit. Retensi, aksesibilitas, rate limit dan backup tetap wajib.

Job rekonsiliasi bukan overengineering: provider bisa gagal pada pesanan pertama sekalipun. Trigger database tidak berjalan sendiri saat jam lewat. Kegagalan provider menahan alokasi stok sampai status pasti dan memerlukan alarm; pelepasan berdasarkan timer saja dilarang.

## Kapan menambah sesuatu

- State library jika state lintas layar terbukti sulit dengan React; bukan karena template membawanya.
- Kamera QR jika volume booth dan uji staf membuktikan input kode menghambat; kode manual tetap cadangan.
- Notifikasi otomatis jika tim sudah punya channel, izin, biaya dan retry policy; jangan membuat pembayaran bergantung keberhasilan kirim pesan.
- Kurir setelah tarif, area, SLA, tracking dan kebijakan gagal kirim disetujui.
- Kustomisasi setelah biaya per unit, batas teks/karakter, preview/persetujuan, kapasitas dan cutoff tersedia.
- Diskon kolektif setelah margin dan batas tier termasuk 100+ diputuskan; tidak menyalin angka simulasi ke produksi.
- Queue terpisah/scale DB hanya dari metrik latensi, backlog, lock contention atau kebutuhan isolasi. Tidak memakai ambang “jutaan transaksi per detik” rekaan.

Perubahan stack atau fitur tertunda wajib memperbarui BRD, PRD, SCHEMA, DESIGN dan uji terkait sebelum kode. Pilih diff terkecil yang menjaga invariant, bukan abstraksi untuk kemungkinan nanti.
