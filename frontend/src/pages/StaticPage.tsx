import { Alert, Link, PageHeader } from "../components/ui";

const COPY = {
  privacy: {
    title: "Privasi demo",
    body: [
      "MabaKit versi ini adalah demo presentasi. Tidak ada akun nyata, email, OTP, atau integrasi pembayaran.",
      "Data yang disimpan: nama dan nomor telepon yang Anda isi, isi keranjang, pesanan simulasi, dan cookie sesi tamu. Nomor telepon tidak diverifikasi dan tidak dikirim ke pihak ketiga.",
      "Cookie sesi hanya berlaku di browser ini. Menghapus cookie berarti riwayat pesanan tidak bisa dipulihkan.",
      "Jangan memasukkan data pribadi nyata saat mencoba demo. Gunakan data fiktif.",
    ],
  },
  terms: {
    title: "Ketentuan demo",
    body: [
      "Harga, stok, dan ketersediaan adalah data uji, bukan penawaran resmi kampus.",
      "Tombol Cek status pembayaran tidak menghubungi bank atau dompet digital. Status PAID hanya penanda simulasi.",
      "Invoice yang dihasilkan bukan faktur pajak dan bukan bukti pembayaran nyata.",
      "Pengambilan barang dilakukan di lokasi dan jam layanan yang tertera, tanpa booking atau pemilihan slot.",
    ],
  },
  help: {
    title: "Bantuan",
    body: [
      "Alur demo: pilih produk, tambah ke keranjang, isi data fiktif, pilih metode simulasi, lalu tekan Cek status pembayaran.",
      "Setelah PAID, invoice digital bisa dibuka. Kode pickup baru muncul setelah petugas menandai pesanan siap.",
      "Jika draft melewati 30 menit, stok dilepas otomatis dan Anda perlu membuat pesanan baru.",
      "Jika sesi berakhir, muat ulang halaman. Riwayat pesanan terikat pada sesi browser yang sama.",
    ],
  },
} as const;

export default function StaticPage({ page }: { page: keyof typeof COPY }) {
  const copy = COPY[page];
  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description="Konten demo, bukan dokumen legal produksi." />
      <Alert tone="warn">Halaman ini masih draft demo dan belum ditinjau untuk kebutuhan produksi.</Alert>
      <ul className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        {copy.body.map((paragraph) => (
          <li key={paragraph} className="text-ink">
            {paragraph}
          </li>
        ))}
      </ul>
      <Link to="/catalog" className="font-semibold text-brand underline">
        Kembali ke katalog
      </Link>
    </div>
  );
}
