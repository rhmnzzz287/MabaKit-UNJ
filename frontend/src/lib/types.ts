export type Variant = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  priceRp: number;
  stock: number;
};

export type Product = {
  id: string;
  kind: "single" | "bundle";
  title: string;
  description: string;
  imagePath: string | null;
  priceRp: number;
  stock: number;
  variants: Variant[];
  components?: { variantId: string; sku: string; quantity: number }[];
};

export type OrderItem = {
  id: string;
  title: string;
  attributes: Record<string, string>;
  quantity: number;
  unitPriceRp: number;
  lineTotalRp: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  buyerName: string;
  recipientName: string;
  contactPhone: string;
  departmentId: string | null;
  totalRp: number;
  paymentStatus: "PENDING" | "PAID" | "EXPIRED";
  fulfillmentStatus: "UNFULFILLED" | "READY" | "PICKED_UP" | "CANCELLED";
  method: "BANK_TRANSFER" | "EWALLET" | "QRIS" | null;
  createdAt: number;
  expiresAt: number;
  paidAt: number | null;
  readyAt: number | null;
  pickedUpAt: number | null;
  pickup: { label: string; details: string; hours: string; version: number };
  items: OrderItem[];
  invoice: { invoiceNumber: string; issuedAt: number } | null;
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
