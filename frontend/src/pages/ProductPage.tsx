import { useEffect, useMemo, useState } from "react";
import { get } from "../lib/api";
import { addToCart } from "../lib/cart";
import { variantLabel } from "../lib/format";
import { navigate } from "../lib/router";
import type { Product } from "../lib/types";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  Link,
  Price,
  ProductPhoto,
  Select,
  Spinner,
} from "../components/ui";

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav aria-label="Remah roti" className="text-sm text-muted">
      <Link to="/catalog" className="font-medium text-brand-dark">
        Paket dan Produk
      </Link>
      <span aria-hidden="true"> / </span>
      <span>{title}</span>
    </nav>
  );
}

export default function ProductPage({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variantId, setVariantId] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [pickedPhoto, setPickedPhoto] = useState(false);
  const [choseVariant, setChoseVariant] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPhotoIndex(0);
    setPickedPhoto(false);
    setChoseVariant(false);
    get<{ product: Product }>(`/api/catalog/${id}`)
      .then((body) => {
        if (!active) return;
        setProduct(body.product);
        setVariantId(body.product.variants[0]?.id ?? "");
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Produk gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  const variant = useMemo(
    () => product?.variants.find((item) => item.id === variantId) ?? null,
    [product, variantId],
  );

  // Pilih varian mengembalikan hero ke foto varian; galeri tetap bisa dibuka manual.
  useEffect(() => {
    setPickedPhoto(false);
    setPhotoIndex(0);
  }, [variantId]);
  if (error) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{error}</Alert>
        <Link to="/catalog" className="font-semibold text-brand-dark">
          Kembali ke katalog
        </Link>
      </div>
    );
  }
  if (!product) return <Spinner label="Memuat produk" />;

  if (product.kind === "bundle") {
    return (
      <div className="space-y-6">
        <Breadcrumb title={product.title} />
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{product.title}</h1>
        <Alert tone="info">
          Isi dan harga paket bergantung pada fakultas. Sesuaikan paket untuk melihat rincian dan stok yang benar.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to={`/packages/${product.id}/customize`}>Sesuaikan paket</ButtonLink>
          <ButtonLink to="/catalog" variant="secondary">
            Kembali ke katalog
          </ButtonLink>
        </div>
      </div>
    );
  }

  const available = variant?.stock ?? 0;
  const unitPrice = variant?.finalPriceRp ?? variant?.priceRp ?? product.finalPriceRp ?? product.priceRp;
  const gallery = product.photos ?? [];
  const activePhoto = gallery[photoIndex] ?? gallery[0] ?? null;
  // Default: foto galeri admin. Setelah pembeli memilih varian, foto varian yang tampil.
  const useVariantHero = !pickedPhoto && (choseVariant || activePhoto === null) && variant?.imagePath !== undefined;

  return (
    <div className="space-y-8">
      <Breadcrumb title={product.title} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden p-2">
            <ProductPhoto
              src={useVariantHero ? variant?.imagePath : (activePhoto?.url ?? variant?.imagePath ?? product.imagePath)}
              srcSet480={useVariantHero ? (variant?.imagePath480 ?? null) : null}
              alt={variant ? `Foto ${product.title} ${variantLabel(variant.attributes)}` : `Foto ${product.title}`}
              width={useVariantHero ? undefined : activePhoto?.width}
              height={useVariantHero ? undefined : activePhoto?.height}
              className="h-72 w-full rounded-xl sm:h-96"
              eager
            />
          </Card>
          {gallery.length > 1 ? (
            <div role="group" aria-label="Galeri foto produk" className="flex flex-wrap gap-2">
              {gallery.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-pressed={activePhoto?.id === photo.id}
                  aria-label={`Foto ${index + 1} dari ${gallery.length}`}
                  onClick={() => {
                    setPhotoIndex(index);
                    setPickedPhoto(true);
                  }}
                  className={`size-12 overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 ${
                    activePhoto?.id === photo.id ? "border-brand" : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <img src={photo.url} alt="" width={48} height={48} loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{product.title}</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted">{product.description}</p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
            <div className="bg-white p-4">
              <dt className="text-sm text-muted">Jenis</dt>
              <dd className="font-semibold text-ink">Satuan</dd>
            </div>
            <div className="bg-white p-4">
              <dt className="text-sm text-muted">Ketersediaan</dt>
              <dd className={`font-semibold ${available > 0 ? "text-ink" : "text-danger"}`}>
                {available > 0 ? `${available} tersedia` : "Habis"}
              </dd>
            </div>
            <div className="col-span-2 bg-white p-4 sm:col-span-1">
              <dt className="text-sm text-muted">Spesifikasi</dt>
              <dd className="font-semibold text-ink">{variant ? variantLabel(variant.attributes) || "-" : "-"}</dd>
            </div>
          </dl>
        </div>

        <Card className="sticky top-24 h-fit space-y-6 p-6">
          <div className="space-y-2">
            <Price
              finalRp={unitPrice}
              baseRp={variant?.basePriceRp ?? product.basePriceRp}
              discountBasisPoints={product.discountBasisPoints}
              size="lg"
            />
            <p className="text-sm text-muted">Harga per unit, dihitung ulang di server saat checkout.</p>
          </div>

          <div className="space-y-4 border-t border-slate-200 pt-6">
            {product.variants.length > 1 ? (
              <Field id="variant" label="Pilih varian">
                <Select id="variant" value={variantId} onChange={(event) => { setChoseVariant(true); setVariantId(event.target.value); }}>
                  {product.variants.map((item) => (
                    <option key={item.id} value={item.id} disabled={item.stock < 1}>
                      {variantLabel(item.attributes) || item.sku} ({item.stock} tersedia)
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field id="quantity" label="Jumlah" hint={`Maksimal ${Math.max(1, Math.min(99, available))} unit per pesanan.`}>
              <Input
                id="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.max(1, Math.min(99, available))}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
              />
            </Field>
          </div>

          <Button
            full
            disabled={available < 1}
            onClick={() => {
              if (available < 1) return;
              if (!variant) {
                setNotice("Pilih varian terlebih dahulu.");
                return;
              }
              addToCart({
                productId: product.id,
                variantId: variant.id,
                facultyId: null,
                facultyName: null,
                title: product.title,
                variantLabel: variantLabel(variant.attributes),
                priceRp: unitPrice,
                quantity: Math.min(quantity, available),
              });
              navigate("/cart");
            }}
          >
            {available < 1 ? "Stok habis" : "Tambah ke keranjang"}
          </Button>
          {notice ? <Alert tone="error">{notice}</Alert> : null}
          <p className="text-center text-sm text-muted">Butuh isi lengkap? Paket fakultas lebih hemat waktu.</p>
          <ButtonLink to="/catalog" variant="quiet" className="w-full">
            Lihat paket fakultas
          </ButtonLink>
        </Card>
      </div>
    </div>
  );
}
