import { PageHeader, Link } from "../components/ui";

const POINTS = [
  {
    title: "Satu tempat, satu paket",
    body: "Perlengkapan PKKMB disusun per fakultas supaya tidak perlu belanja terpisah. Paket berisi barang umum dan barang beridentitas fakultas.",
  },
  {
    title: "Harga dan stok dari server",
    body: "Harga, stok, dan isi paket dihitung ulang di server saat pesanan dibuat. Angka di layar adalah estimasi sampai pesanan tersimpan.",
  },
  {
    title: "Ambil di kampus",
    body: "Pesanan diambil di lokasi dan jam layanan yang tertera pada halaman pembayaran. Tidak ada pengiriman atau pemilihan jadwal.",
  },
  {
    title: "Transparan soal simulasi",
    body: "Versi ini adalah demo. Pembayaran ditandai manual lewat tombol simulasi dan tidak ada penagihan nyata.",
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Tentang MabaKit"
        description="MabaKit menyiapkan perlengkapan PKKMB per fakultas dalam satu alur pesan yang ringkas."
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {POINTS.map((point) => (
          <li key={point.title} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-ink">{point.title}</h2>
            <p className="text-sm text-muted">{point.body}</p>
          </li>
        ))}
      </ul>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-ink">Cara memesan</h2>
        <ol className="list-decimal space-y-2 pl-6 text-ink">
          <li>Pilih paket atau produk, lalu tentukan fakultas.</li>
          <li>Periksa isi dan harga, lalu tambahkan ke keranjang.</li>
          <li>Masuk atau daftar akun untuk melanjutkan checkout.</li>
          <li>Tandai pembayaran simulasi, lalu ambil pesanan setelah status siap diambil.</li>
        </ol>
      </section>

      <p className="text-sm text-muted">
        MabaKit bukan toko resmi kampus dan tidak mewakili universitas mana pun. Nama fakultas dipakai untuk menandai
        identitas barang pada katalog.{" "}
        <Link to="/contact" className="font-semibold text-brand underline">
          Hubungi kami
        </Link>{" "}
        untuk pertanyaan.
      </p>
    </div>
  );
}
