import { PageHeader } from "../components/ui";

const ADDRESS = [
  "Jalan R.Mangun Muka Raya No. 11",
  "Kelurahan: Rawamangun",
  "Kecamatan: Pulo Gadung",
  "Kota: Jakarta Timur, Daerah Khusus Ibukota Jakarta 13220",
];

const WHATSAPP_DISPLAY = "+6283874234882";
const WHATSAPP_URL = "https://wa.me/6283874234882";

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Hubungi Kami" description="Alamat dan WhatsApp resmi untuk pertanyaan seputar pesanan demo." />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-ink">Alamat</h2>
          <address className="not-italic text-ink">
            {ADDRESS.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-ink">WhatsApp</h2>
          <p className="text-ink">{WHATSAPP_DISPLAY}</p>
          <a
            href={WHATSAPP_URL}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark"
            rel="noreferrer noopener"
            target="_blank"
          >
            Buka chat WhatsApp
          </a>
          <p className="text-sm text-muted">
            Tautan membuka aplikasi WhatsApp. Membuka chat tidak berarti pesan sudah terkirim sampai Anda menekan kirim
            di aplikasi.
          </p>
        </section>
      </div>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-ink">Pengambilan pesanan</h2>
        <p className="text-ink">
          Lokasi dan jam pengambilan mengikuti pengaturan yang tampil pada halaman pembayaran dan invoice pesanan Anda.
        </p>
        <p className="text-sm text-muted">
          Alamat di atas adalah alamat kontak. Lokasi pengambilan bisa berbeda dan selalu disalin ke pesanan saat checkout.
        </p>
      </section>
    </div>
  );
}
