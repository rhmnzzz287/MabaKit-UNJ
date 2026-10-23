export type Variant = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  imagePath: string | null;
  imagePath480: string | null;
  basePriceRp?: number;
  finalPriceRp?: number;
  priceRp: number;
  stock: number;
  faculties: string[];
};

export type FacultyOption = {
  facultyId: string;
  facultyName: string;
  priceRp: number;
  stock: number;
};

export type GalleryPhoto = {
  id: string;
  url: string;
  width: number;
  height: number;
};

export type Product = {
  id: string;
  kind: "single" | "bundle";
  title: string;
  description: string;
  imagePath: string | null;
  photos?: GalleryPhoto[];
  basePriceRp?: number;
  discountBasisPoints?: number;
  finalPriceRp?: number;
  priceRp: number;
  stock: number;
  variants: Variant[];
  facultyOptions?: FacultyOption[];
};

export type Faculty = {
  id: string;
  name: string;
  aliases: string[];
};

export type CatalogResponse = {
  faculties: Faculty[];
  packages: Product[];
  products: Product[];
};

export type QuoteComponent = {
  variantId: string;
  sku: string;
  title: string;
  attributes: Record<string, string>;
  imagePath: string | null;
  quantity: number;
  unitPriceRp: number;
  lineTotalRp: number;
  basePriceRp?: number;
  discountBasisPoints?: number;
  stock: number;
};

export type PackageQuote = {
  package: { id: string; title: string; description: string; imagePath: string | null };
  faculty: { id: string; name: string };
  components: QuoteComponent[];
  priceRp: number;
  unitTotalRp: number;
  savingsRp: number;
  stock: number;
  available: boolean;
};

export type ItemComponent = {
  variantId: string;
  sku: string;
  title: string;
  attributes: Record<string, string>;
  quantity: number;
};

export type OrderItem = {
  id: string;
  title: string;
  attributes: Record<string, string>;
  quantity: number;
  unitPriceRp: number;
  lineTotalRp: number;
  basePriceRp?: number;
  discountBasisPoints?: number;
  components: ItemComponent[];
};

export type Review = {
  displayName: string;
  rating: number;
  comment: string;
  createdAt: number;
  isExample: boolean;
};

export type Profile = {
  name: string;
  whatsapp: string;
  email: string;
  facultyId: string | null;
  updatedAt: number;
};

export type User = {
  id: string;
  email: string;
  role: "buyer" | "staff" | "admin";
  name: string;
  whatsapp: string;
  facultyId: string | null;
  permissions: string[];
};

export type Order = {
  id: string;
  orderNumber: string;
  buyerName: string;
  contactPhone: string;
  email: string | null;
  facultyId: string | null;
  totalRp: number;
  paymentStatus: "PENDING" | "PAID" | "EXPIRED";
  fulfillmentStatus: "UNFULFILLED" | "READY" | "PICKED_UP" | "CANCELLED";
  method: "BANK_TRANSFER" | "EWALLET" | "QRIS" | "FREE" | null;
  createdAt: number;
  expiresAt: number;
  paidAt: number | null;
  readyAt: number | null;
  pickedUpAt: number | null;
  pickup: { label: string; details: string; hours: string; version: number };
  items: OrderItem[];
  invoice: { invoiceNumber: string; issuedAt: number } | null;
  review: { rating: number; comment: string; createdAt: number } | null;
  reviewEligible: boolean;
};

export type Invoice = {
  invoiceNumber: string;
  issuedAt: number;
  mode: "DEMO";
  watermark: string;
  order: Order;
};

export type AdminSummary = {
  settings: {
    checkoutEnabled: boolean;
    pickup: { label: string; details: string; hours: string; version: number };
    updatedAt: number;
  } | null;
  variants: {
    id: string;
    sku: string;
    title: string;
    priceRp: number;
    stockOnHand: number;
    stockReserved: number;
    active: boolean;
  }[];
  counts: { pending: number; paid: number; expired: number; ready: number; pickedUp: number };
};

export type AdminVariant = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  priceRp: number;
  stockOnHand: number;
  stockReserved: number;
  active: boolean;
  sellable: boolean;
};

export type AdminConfig = {
  id: string;
  facultyId: string;
  facultyName: string;
  priceRp: number;
  published: boolean;
  components: { variantId: string; quantity: number }[];
};

export type AdminProduct = {
  id: string;
  kind: "single" | "bundle";
  title: string;
  description: string;
  imagePath: string | null;
  photos: { id: string; url: string; width: number; height: number }[];
  discountBasisPoints?: number;
  active: boolean;
  version: number;
  variants: AdminVariant[];
  configs: AdminConfig[];
};

export type AdminCatalog = {
  products: AdminProduct[];
  faculties: (Faculty & { active: boolean })[];
};

export type TeamSummary = {
  period: "today" | "7d" | "30d" | "all";
  rangeStart: number | null;
  sales: { paidValueRp: number; paidOrders: number; simulated: true };
  counts: { pending: number; preparing: number; ready: number; completed: number };
};

export type TeamOrdersPage = {
  orders: Order[];
  nextCursor: string | null;
};

export type Operator = {
  id: string;
  email: string;
  name: string;
  role: "staff" | "admin";
  permissions: string[];
  disabled: boolean;
  lastLoginAt: number | null;
  activeSessions: number;
};

export type AdminKpi = {
  period: "today" | "7d" | "30d" | "all";
  rangeStart: number | null;
  sales: { paidValueRp: number; paidOrders: number; simulated: true };
  staff: {
    id: string;
    name: string;
    email: string;
    role: string;
    disabled: boolean;
    readyCount: number;
    completeCount: number;
    lastTransitionAt: number | null;
  }[];
  unattributed: { readyCount: number; completeCount: number };
};

export type SessionInfo = {
  session: { expiresAt: number } | null;
  user: User | null;
  role: "buyer" | "staff" | "admin" | null;
  portal: "buyer" | "operator";
};
