import { ButtonLink, Card } from "../components/ui";

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
    <div className="space-y-12">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-black tracking-tight text-ink sm:text-5xl">Ada yang perlu ditanyakan?</h1>
        <p className="text-lg text-muted">Alamat dan WhatsApp resmi untuk pertanyaan seputar pesanan demo.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="space-y-4 p-6 sm:p-8">
          <h2 className="text-sm font-bold text-ink">Alamat</h2>
          <address className="space-y-1 text-lg not-italic font-medium leading-relaxed text-ink">
            {ADDRESS.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
          <p className="border-t border-slate-200 pt-4 text-sm leading-relaxed text-muted">
            Alamat di atas adalah alamat kontak. Lokasi pengambilan bisa berbeda dan selalu disalin ke pesanan saat
            checkout.
          </p>
        </Card>

        <Card className="space-y-4 p-6 sm:p-8">
          <h2 className="text-sm font-bold text-ink">WhatsApp</h2>
          <p className="font-mono text-2xl font-bold tracking-tight text-ink">{WHATSAPP_DISPLAY}</p>
          <ButtonLink to={WHATSAPP_URL} external>
            Buka chat WhatsApp
          </ButtonLink>
          <p className="text-sm leading-relaxed text-muted">
            Tautan membuka aplikasi WhatsApp. Membuka chat tidak berarti pesan sudah terkirim sampai Anda menekan kirim
            di aplikasi.
          </p>
        </Card>
      </div>

      <Card className="space-y-3 p-6 sm:p-8">
        <h2 className="text-lg font-bold tracking-tight text-ink">Pengambilan pesanan</h2>
        <p className="text-ink">
          Lokasi dan jam pengambilan mengikuti pengaturan yang tampil pada halaman pembayaran dan invoice pesanan Anda.
        </p>
        <p className="text-sm text-muted">
          Tidak ada pengiriman kurir dan tidak ada pemilihan jadwal pada versi demo ini.
        </p>
      </Card>
    </div>
  );
}
