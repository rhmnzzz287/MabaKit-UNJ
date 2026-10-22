import { useEffect, useState } from "react";
import { ensureSession } from "./lib/api";
import { cartCount, subscribeCart } from "./lib/cart";
import { Link } from "./components/ui";
import { usePathname } from "./lib/router";
import CatalogPage from "./pages/CatalogPage";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentPage from "./pages/PaymentPage";
import { OrderDetailPage, OrdersPage } from "./pages/OrdersPage";
import InvoicePage from "./pages/InvoicePage";
import StaffPage from "./pages/StaffPage";
import AdminPage from "./pages/AdminPage";
import StaticPage from "./pages/StaticPage";

function Routes({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);

  if (parts.length === 0) return <CatalogPage />;
  if (parts[0] === "products" && parts[1]) return <ProductPage id={parts[1]} />;
  if (parts[0] === "cart") return <CartPage />;
  if (parts[0] === "checkout") return <CheckoutPage />;
  if (parts[0] === "orders" && !parts[1]) return <OrdersPage />;
  if (parts[0] === "orders" && parts[1] && parts[2] === "payment") return <PaymentPage id={parts[1]} />;
  if (parts[0] === "orders" && parts[1] && parts[2] === "invoice") return <InvoicePage id={parts[1]} />;
  if (parts[0] === "orders" && parts[1]) return <OrderDetailPage id={parts[1]} />;
  if (parts[0] === "staff" && (parts[1] === "orders" || parts[1] === "pickup")) return <StaffPage />;
  if (parts[0] === "admin") return <AdminPage />;
  if (parts[0] === "privacy" || parts[0] === "terms" || parts[0] === "help") return <StaticPage page={parts[0]} />;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-ink">Halaman tidak ditemukan</h1>
      <p className="text-muted">Alamat ini tidak ada di aplikasi demo.</p>
      <Link to="/" className="font-semibold text-brand underline">
        Kembali ke katalog
      </Link>
    </div>
  );
}

export default function App() {
  const path = usePathname();
  const [count, setCount] = useState(cartCount);

  useEffect(() => subscribeCart(() => setCount(cartCount())), []);

  useEffect(() => {
    ensureSession().catch(() => undefined);
  }, []);

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Katalog",
      "/cart": "Keranjang",
      "/checkout": "Checkout",
      "/orders": "Pesanan",
      "/staff/orders": "Staf",
      "/staff/pickup": "Staf",
      "/admin": "Admin",
    };
    document.title = `${titles[path] ?? "MabaKit"} | MabaKit`;
  }, [path]);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-ink"
      >
        Lewati ke konten
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-brand-dark">
            MabaKit
          </Link>
          <nav aria-label="Navigasi utama" className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <Link to="/" className="min-h-12 content-center text-ink hover:underline">
              Katalog
            </Link>
            <Link to="/cart" className="min-h-12 content-center text-ink hover:underline">
              Keranjang{count > 0 ? ` (${count})` : ""}
            </Link>
            <Link to="/orders" className="min-h-12 content-center text-ink hover:underline">
              Pesanan
            </Link>
            <Link to="/help" className="min-h-12 content-center text-ink hover:underline">
              Bantuan
            </Link>
          </nav>
        </div>
      </header>

      <main id="konten" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Routes path={path} />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted">
          <p>Demo simulasi perlengkapan PKKMB. Bukan toko resmi kampus.</p>
          <nav aria-label="Navigasi kaki" className="flex flex-wrap gap-4">
            <Link to="/privacy" className="min-h-12 content-center hover:underline">
              Privasi
            </Link>
            <Link to="/terms" className="min-h-12 content-center hover:underline">
              Ketentuan
            </Link>
            <Link to="/staff/orders" className="min-h-12 content-center hover:underline">
              Staf
            </Link>
            <Link to="/admin" className="min-h-12 content-center hover:underline">
              Admin
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
