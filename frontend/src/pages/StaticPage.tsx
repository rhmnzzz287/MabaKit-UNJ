import { Alert, ButtonLink, Card, PageHeader } from "../components/ui";

const COPY = {
  privacy: {
    title: "Privasi demo",
    body: [
      "MabaKit versi ini adalah demo presentasi. Tidak ada integrasi pembayaran, pengiriman email, atau layanan pihak ketiga.",
      "Data yang disimpan: nama, email, nomor WhatsApp, fakultas, isi keranjang, dan pesanan simulasi pada akun demo Anda.",
      "Cookie sesi hanya berlaku di browser ini. Keluar dari akun berarti Anda perlu masuk kembali untuk melihat pesanan.",
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
      "Alur demo: pilih paket atau produk, tentukan fakultas, tambah ke keranjang, lalu masuk ke akun pembeli.",
      "Setelah checkout, tandai pembayaran simulasi lewat tombol Cek status pembayaran. Invoice digital bisa dibuka setelah PAID.",
      "Pesanan gratis dari diskon 100 persen langsung tercatat tanpa halaman pembayaran.",
      "Jika draft melewati 30 menit, stok dilepas otomatis dan Anda perlu membuat pesanan baru.",
    ],
  },
} as const;

export default function StaticPage({ page }: { page: keyof typeof COPY }) {
  const copy = COPY[page];
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={copy.title} description="Konten demo, bukan dokumen legal produksi." />
      <Alert tone="warn">Halaman ini masih draft demo dan belum ditinjau untuk kebutuhan produksi.</Alert>
      <Card className="space-y-5 p-6 sm:p-8">
        {copy.body.map((paragraph) => (
          <p key={paragraph} className="text-ink">
            {paragraph}
          </p>
        ))}
      </Card>
      <ButtonLink to="/catalog" variant="secondary">
        Kembali ke katalog
      </ButtonLink>
    </div>
  );
}
