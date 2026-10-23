import { useEffect, useState } from "react";
import { ensureSession } from "./lib/api";
import { cartCount, subscribeCart } from "./lib/cart";
import { Link } from "./components/ui";
import { usePathname } from "./lib/router";
import { useOperatorWorkspace, useWorkspace } from "./lib/workspace";
import { refreshAuth, useAuthRevalidation } from "./lib/auth-store";
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import ProductPage from "./pages/ProductPage";
import CustomizePage from "./pages/CustomizePage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentPage from "./pages/PaymentPage";
import { OrderDetailPage, OrdersPage } from "./pages/OrdersPage";
import InvoicePage from "./pages/InvoicePage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import OperatorLoginPage from "./pages/OperatorLoginPage";
import { TeamDashboardPage, TeamOrderDetailPage, TeamOrdersPage } from "./pages/TeamPage";
import StaticPage from "./pages/StaticPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";

const NAV = [
  { to: "/", label: "Beranda" },
  { to: "/catalog", label: "Paket dan Produk" },
  { to: "/about", label: "Tentang Kami" },
  { to: "/contact", label: "Hubungi Kami" },
];

function Routes({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);

  if (parts.length === 0) return <HomePage />;
  if (parts[0] === "catalog") return <CatalogPage />;
  if (parts[0] === "products" && parts[1]) return <ProductPage id={parts[1]} />;
  if (parts[0] === "packages" && parts[1] && parts[2] === "customize") return <CustomizePage id={parts[1]} />;
  if (parts[0] === "cart") return <CartPage />;
  if (parts[0] === "login") return <LoginPage />;
  if (parts[0] === "register") return <RegisterPage />;
  if (parts[0] === "checkout") return <CheckoutPage />;
  if (parts[0] === "orders" && !parts[1]) return <OrdersPage />;
  if (parts[0] === "orders" && parts[1] && parts[2] === "payment") return <PaymentPage id={parts[1]} />;
  if (parts[0] === "orders" && parts[1] && parts[2] === "invoice") return <InvoicePage id={parts[1]} />;
  if (parts[0] === "orders" && parts[1]) return <OrderDetailPage id={parts[1]} />;
  if (parts[0] === "profile") return <ProfilePage />;
  if (parts[0] === "about") return <AboutPage />;
  if (parts[0] === "contact") return <ContactPage />;
  if (parts[0] === "operator" && parts[1] === "login") return <OperatorLoginPage />;
  if (parts[0] === "team" && !parts[1]) return <TeamDashboardPage />;
  if (parts[0] === "team" && parts[1] === "orders" && !parts[2]) return <TeamOrdersPage />;
  if (parts[0] === "team" && parts[1] === "orders" && parts[2]) return <TeamOrderDetailPage id={parts[2]} />;
  if (parts[0] === "admin") return <AdminPage section={parts[1]} />;
  if (parts[0] === "privacy" || parts[0] === "terms") return <StaticPage page={parts[0]} />;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-ink">Halaman tidak ditemukan</h1>
      <p className="text-muted">Alamat ini tidak ada di aplikasi demo.</p>
      <Link to="/" className="font-semibold text-brand underline">
        Kembali ke beranda
      </Link>
    </div>
  );
}

export default function App() {
  const path = usePathname();
  const workspace = useWorkspace();
  const operator = useOperatorWorkspace();
  const operatorRole = operator.state === "ready" && (operator.role === "staff" || operator.role === "admin") ? operator.role : null;
  const signedIn = workspace.state === "ready" && workspace.user !== null;
  const [count, setCount] = useState(cartCount);
  useAuthRevalidation();

  useEffect(() => {
    void refreshAuth("buyer");
    void refreshAuth("operator");
  }, []);

  useEffect(() => subscribeCart(() => setCount(cartCount())), []);

  useEffect(() => {
    ensureSession().catch(() => undefined);
  }, []);

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Beranda",
      "/catalog": "Paket dan Produk",
      "/cart": "Keranjang",
      "/checkout": "Checkout",
      "/orders": "Pesanan Saya",
      "/profile": "Akun",
      "/login": "Masuk",
      "/register": "Daftar",
      "/about": "Tentang Kami",
      "/contact": "Hubungi Kami",
      "/operator/login": "Masuk tim",
      "/team": "Workspace tim",
      "/team/orders": "Pesanan tim",
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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
          <Link to="/" className="min-h-12 content-center text-lg font-bold text-brand-dark">
            MabaKit
          </Link>
          <nav aria-label="Navigasi utama" className="flex flex-wrap items-center gap-x-4 text-sm font-medium">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="min-h-12 content-center text-ink hover:underline">
                {item.label}
              </Link>
            ))}
            <Link to="/cart" className="min-h-12 content-center text-ink hover:underline">
              Keranjang{count > 0 ? ` (${count})` : ""}
            </Link>
            {signedIn ? (
              <>
                <Link to="/profile" className="min-h-12 content-center text-ink hover:underline">
                  Akun
                </Link>
                <Link to="/orders" className="min-h-12 content-center text-ink hover:underline">
                  Pesanan Saya
                </Link>
              </>
            ) : (
              <Link to="/login" className="min-h-12 content-center font-semibold text-brand underline">
                Masuk
              </Link>
            )}
            {operatorRole ? (
              <Link to="/team" className="min-h-12 content-center text-ink hover:underline">
                Workspace tim
              </Link>
            ) : null}
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
            <Link to="/about" className="min-h-12 content-center hover:underline">
              Tentang
            </Link>
            <Link to="/contact" className="min-h-12 content-center hover:underline">
              Kontak
            </Link>
            <Link to="/privacy" className="min-h-12 content-center hover:underline">
              Privasi
            </Link>
            <Link to="/terms" className="min-h-12 content-center hover:underline">
              Ketentuan
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
