# AGENT.md: panduan agen untuk MabaKit

Revisi: 22 Oktober 2026. File ini mengarahkan agen coding yang bekerja di repo ini. Sumber kebenaran tetap dokumen di `docs/`; file ini tidak menggantikannya.

## Baca dulu, sesuai urutan

1. `docs/README.md`: tujuan project, cakupan rilis pertama, dan batasan revisi.
2. `docs/BRD.md`: masalah pelanggan, keputusan bisnis D01-D08 (semua masih BELUM DIKONFIRMASI).
3. `docs/PRD.md`: alur belanja, pembayaran, acceptance criteria.
4. `docs/SCHEMA.md`: kontrak data, transaksi checkout, akses, konsistensi stok.
5. `docs/DESIGN.md`: arsitektur, layar, token visual, aksesibilitas.
6. `docs/KISS.md`: batas kompleksitas dan alasan penundaan fitur.
7. `docs/RELEASE.md`: gerbang pengujian yang wajib sebelum menerima uang nyata.

Konflik aturan uang, status atau akses diselesaikan di PRD dan SCHEMA sebelum kode. Jika dokumen bertentangan dengan kode, dokumen yang menang; usulkan perubahan dokumen alih-alih diam-diam menyesuaikan kode.

## Batas project (jangan dilanggar)

- **Booking/reservasi di luar cakupan**: tidak ada kalender, pilihan slot, kuota kunjungan, booking fee atau reschedule, termasuk di uji dan skema. Alokasi stok sementara (`stock_allocation_status`: HELD/CONSUMED/RELEASED) adalah pengaman pembayaran internal, bukan reservasi pelanggan.
- Tidak ada klaim resmi kampus (UNJ/BEM/HIMA) atau angka harga/pajak tanpa persetujuan pemilik. Data contoh wajib berlabel SIMULASI.
- Status lunas hanya dari provider terverifikasi (signature + Status API), bukan callback browser atau screenshot.
- Harga dan total dihitung server; snapshot order tidak berubah setelah checkout.
- Pelanggan tidak dapat menulis role/status/harga/stok; semua mutasi sensitif lewat transaksi atau RPC terpercaya dengan audit.
- Tidak menyimpan Server Key, service-role key atau token pickup di bundle, URL atau log.

## Keputusan pemilik yang memblokir

D01-D08 di BRD masih BELUM DIKONFIRMASI. Fitur terkait keputusan yang belum ada jangan diimplementasi sampai pemilik mengisi keputusan tersebut. Sandbox boleh memakai fixture SIMULASI; jangan anggap fixture sebagai data produksi.

## Aturan kerja teknis

- Stack rilis pertama: React + TypeScript + Vite + Tailwind CSS, Supabase (PostgreSQL + RLS + transactional RPC + Edge Functions), Midtrans Snap, hosting SPA di Vercel. Jangan menambah dependency atau layanan tanpa alasan yang tercatat di KISS.
- Uang = integer rupiah (`bigint`), tanpa float. Waktu disimpan UTC (`timestamptz`), ditampilkan WIB.
- Logika bisnis atomik tinggal di PostgreSQL RPC, bukan diduplikasi di browser/Edge.
- Setiap logika nontrivial punya runnable test; race condition dan kasus di `docs/RELEASE.md` diuji di database nyata, bukan mock saja.
- Aksesibilitas wajib: WCAG AA, navigasi keyboard, status selain warna, mobile mulai 360px.
- Jangan memakai em dash (`—`) dalam teks UI atau dokumen baru.

## Alur kerja agen

1. Sebelum mengubah kode, pastikan scope disetujui (lihat `docs/README.md` bagian "Mulai implementasi").
2. Buat rencana tugas kecil dari PRD/SCHEMA; setiap tugas punya definisi selesai yang dapat diuji.
3. Kerjakan dengan TDD: test dulu, lihat gagal, implementasi, lihat lolos.
4. Sebelum mengklaim selesai, jalankan verifikasi nyata dan lampirkan bukti (perintah + hasil). Checkbox di RELEASE hanya dicentang dengan bukti.
5. Perubahan yang menyentuh kontrak uang/status/akses wajib memperbarui PRD/SCHEMA di commit yang sama.
