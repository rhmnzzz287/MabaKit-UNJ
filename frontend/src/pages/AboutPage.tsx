import { ButtonLink, Card, Link } from "../components/ui";

const POINTS = [
  {
    title: "Satu tempat, satu paket",
    body: "Perlengkapan PKKMB disusun per fakultas supaya tidak perlu belanja terpisah. Paket berisi barang umum dan barang beridentitas fakultas.",
    mark: "01",
  },
  {
    title: "Harga dan stok dari server",
    body: "Harga, stok, dan isi paket dihitung ulang di server saat pesanan dibuat. Angka di layar adalah estimasi sampai pesanan tersimpan.",
    mark: "02",
  },
  {
    title: "Ambil di kampus",
    body: "Pesanan diambil di lokasi dan jam layanan yang tertera pada halaman pembayaran. Tidak ada pengiriman atau pemilihan jadwal.",
    mark: "03",
  },
  {
    title: "Transparan soal simulasi",
    body: "Versi ini adalah demo. Pembayaran ditandai manual lewat tombol simulasi dan tidak ada penagihan nyata.",
    mark: "04",
  },
];

const STEPS = [
  "Pilih paket atau produk, lalu tentukan fakultas.",
  "Periksa isi dan harga, lalu tambahkan ke keranjang.",
  "Masuk atau daftar akun untuk melanjutkan checkout.",
  "Tandai pembayaran simulasi, lalu ambil pesanan setelah status siap diambil.",
];

export default function AboutPage() {
  return (
    <div className="space-y-16">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-dark">Tentang kami</p>
        <h1 className="text-4xl font-black tracking-tight text-ink sm:text-5xl">Biar urusan ospek cukup sekali jalan.</h1>
        <p className="text-lg text-muted">
          MabaKit menyiapkan perlengkapan PKKMB per fakultas dalam satu alur pesan yang ringkas.
        </p>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2">
        {POINTS.map((point) => (
          <li key={point.title}>
            <Card className="h-full space-y-3 p-6">
              <span aria-hidden="true" className="font-mono text-sm font-bold text-brand">
                {point.mark}
              </span>
              <h2 className="text-lg font-bold tracking-tight text-ink">{point.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{point.body}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="space-y-6 p-6 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight text-ink">Cara memesan</h2>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step} className="space-y-2 border-t-2 border-brand pt-4">
              <span className="font-mono text-sm font-bold text-brand">Langkah {index + 1}</span>
              <p className="text-sm leading-relaxed text-ink">{step}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-col gap-6 rounded-2xl bg-brand-dark px-6 py-10 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p className="max-w-xl text-sm leading-relaxed text-white/80">
          MabaKit bukan toko resmi kampus dan tidak mewakili universitas mana pun. Nama fakultas dipakai untuk menandai
          identitas barang pada katalog.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/catalog" variant="secondary">
            Lihat paket
          </ButtonLink>
          <Link
            to="/contact"
            className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
          >
            Hubungi kami
          </Link>
        </div>
      </div>
    </div>
  );
}
