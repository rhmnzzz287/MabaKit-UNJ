import { describe, expect, test } from "vitest";
import { batch, openDb, seed } from "./db";

const NOW = 1_700_000_000_000;

function checkoutStatements(orderId: string, variantId: string, quantity: number, unitPrice = 15000, version = 1, productId = "p-a") {
  return [
    {
      sql: `INSERT INTO orders (id, order_number, session_id, checkout_key, request_hash, buyer_name, recipient_name,
              contact_phone, pickup_instructions_snapshot, total_rp, payment_status, fulfillment_status,
              stock_allocation_status, created_at, expires_at)
            VALUES (?, ?, 's-1', ?, 'hash', 'Siti', 'Siti', '+6281234567890', '{}', ?, 'PENDING', 'UNFULFILLED', 'HELD', ?, ?)`,
      params: [orderId, `MBK-${orderId}`, orderId, quantity * unitPrice, NOW, NOW + 1_800_000],
    },
    {
      sql: `INSERT INTO order_items (id, order_id, product_id, variant_id, title_snapshot, attributes_snapshot,
              catalog_version, variant_version, quantity, unit_price_rp, line_total_rp)
            VALUES (?, ?, ?, ?, 'Kaos PKKMB', '{}', 1, ?, ?, ?, ?)`,
      params: [`${orderId}-i`, orderId, productId, variantId, version, quantity, unitPrice, quantity * unitPrice],
    },
    {
      sql: `INSERT INTO order_components (order_item_id, variant_id, sku_snapshot, title_snapshot, attributes_snapshot, quantity)
            VALUES (?, ?, 'KAOS-01', 'Kaos PKKMB', '{}', ?)`,
      params: [`${orderId}-i`, variantId, quantity],
    },
    { sql: `INSERT INTO payments (order_id, mode, method) VALUES (?, 'DEMO', 'QRIS')`, params: [orderId] },
  ];
}

describe("guard transaksi D1", () => {
  test("oversell membatalkan seluruh batch, termasuk order dan item", () => {
    const db = openDb();
    seed(db);
    expect(() => batch(db, checkoutStatements("o-1", "v-a", 3))).toThrow(/stock_unavailable/);
    const order = db.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
    const variant = db.prepare("SELECT stock_reserved FROM variants WHERE id = 'v-a'").get() as { stock_reserved: number };
    expect(order.n).toBe(0);
    expect(variant.stock_reserved).toBe(0);
  });

  test("komponen kedua gagal sehingga komponen pertama ikut rollback", () => {
    const db = openDb();
    seed(db);
    db.exec("UPDATE variants SET stock_on_hand = 1 WHERE id = 'v-b'");
    expect(() =>
      batch(db, [
        ...checkoutStatements("o-1", "v-a", 1),
        { sql: `UPDATE orders SET id = id WHERE id = 'o-1'`, params: [] },
      ]),
    ).not.toThrow();
    // paket A x1 + B x2, B hanya 1 -> gagal seluruhnya
    expect(() =>
      batch(db, [
        ...checkoutStatements("o-2", "v-a", 1),
        {
          sql: `INSERT INTO order_components (order_item_id, variant_id, sku_snapshot, title_snapshot, attributes_snapshot, quantity)
                VALUES ('o-2-i', 'v-b', 'TOPI-01', 'Topi', '{}', 2)`,
        },
      ]),
    ).toThrow(/stock_unavailable/);
    const orders = db.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
    const a = db.prepare("SELECT stock_reserved FROM variants WHERE id = 'v-a'").get() as { stock_reserved: number };
    expect(orders.n).toBe(1);
    expect(a.stock_reserved).toBe(1);
  });

  test("dua checkout SKU terakhir hanya satu yang berhasil", () => {
    const db = openDb();
    seed(db);
    db.exec("UPDATE variants SET stock_on_hand = 1 WHERE id = 'v-a'");
    batch(db, checkoutStatements("o-1", "v-a", 1));
    expect(() => batch(db, checkoutStatements("o-2", "v-a", 1))).toThrow(/stock_unavailable/);
    const reserved = db.prepare("SELECT stock_reserved FROM variants WHERE id = 'v-a'").get() as { stock_reserved: number };
    expect(reserved.stock_reserved).toBe(1);
  });

  test("maksimum dua draft HELD per sesi", () => {
    const db = openDb();
    seed(db);
    batch(db, checkoutStatements("o-1", "v-a", 1));
    batch(db, checkoutStatements("o-2", "v-b", 1, 20000, 1, "p-b"));
    expect(() => batch(db, checkoutStatements("o-3", "v-a", 1))).toThrow(/hold_limit/);
  });

  test("harga/versi katalog basi ditolak", () => {
    const db = openDb();
    seed(db);
    expect(() => batch(db, checkoutStatements("o-1", "v-a", 1, 10000))).toThrow(/catalog_changed/);
    expect(() => batch(db, checkoutStatements("o-2", "v-a", 1, 15000, 9))).toThrow(/catalog_changed/);
  });

  test("pembayaran demo mengonsumsi stok dan membuat satu invoice", () => {
    const db = openDb();
    seed(db);
    batch(db, checkoutStatements("o-1", "v-a", 2));
    batch(db, [
      {
        sql: `UPDATE payments SET confirmed_at = ? WHERE order_id = 'o-1' AND confirmed_at IS NULL
              AND EXISTS (SELECT 1 FROM orders WHERE id = 'o-1' AND payment_status = 'PENDING' AND expires_at > ?)`,
        params: [NOW + 1000, NOW + 1000],
      },
    ]);
    const variant = db.prepare("SELECT stock_on_hand, stock_reserved FROM variants WHERE id = 'v-a'").get() as {
      stock_on_hand: number;
      stock_reserved: number;
    };
    const order = db.prepare("SELECT payment_status, stock_allocation_status FROM orders WHERE id = 'o-1'").get() as {
      payment_status: string;
      stock_allocation_status: string;
    };
    const invoices = db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE order_id = 'o-1'").get() as { n: number };
    expect(variant).toEqual({ stock_on_hand: 0, stock_reserved: 0 });
    expect(order).toEqual({ payment_status: "PAID", stock_allocation_status: "CONSUMED" });
    expect(invoices.n).toBe(1);

    batch(db, [
      {
        sql: `UPDATE payments SET confirmed_at = ? WHERE order_id = 'o-1' AND confirmed_at IS NULL`,
        params: [NOW + 2000],
      },
    ]);
    const again = db.prepare("SELECT stock_on_hand FROM variants WHERE id = 'v-a'").get() as { stock_on_hand: number };
    const invoicesAgain = db.prepare("SELECT COUNT(*) AS n FROM invoices").get() as { n: number };
    expect(again.stock_on_hand).toBe(0);
    expect(invoicesAgain.n).toBe(1);
  });

  test("expiry melepas reservasi sekali dan tidak menambah stok fisik", () => {
    const db = openDb();
    seed(db);
    batch(db, checkoutStatements("o-1", "v-a", 2));
    const expire = () =>
      batch(db, [
        {
          sql: `UPDATE orders SET payment_status = 'EXPIRED', fulfillment_status = 'CANCELLED',
                  stock_allocation_status = 'RELEASED'
                WHERE id = 'o-1' AND payment_status = 'PENDING' AND stock_allocation_status = 'HELD' AND expires_at <= ?`,
          params: [NOW + 1_900_000],
        },
        {
          sql: `UPDATE orders SET payment_status = 'EXPIRED', fulfillment_status = 'CANCELLED',
                  stock_allocation_status = 'RELEASED'
                WHERE id = 'o-1' AND payment_status = 'PENDING' AND stock_allocation_status = 'HELD' AND expires_at <= ?`,
          params: [NOW + 1_900_000],
        },
      ]);
    expire();
    expire();
    const variant = db.prepare("SELECT stock_on_hand, stock_reserved FROM variants WHERE id = 'v-a'").get() as {
      stock_on_hand: number;
      stock_reserved: number;
    };
    expect(variant).toEqual({ stock_on_hand: 2, stock_reserved: 0 });
  });

  test("READY hanya setelah PAID lalu klaim pickup sekali", () => {
    const db = openDb();
    seed(db);
    batch(db, checkoutStatements("o-1", "v-a", 1));
    expect(() => db.exec("UPDATE orders SET fulfillment_status = 'READY' WHERE id = 'o-1'")).toThrow(/not_ready_transition/);
    batch(db, [{ sql: `UPDATE payments SET confirmed_at = ? WHERE order_id = 'o-1'`, params: [NOW + 1000] }]);
    db.exec("UPDATE orders SET fulfillment_status = 'READY', ready_at = " + (NOW + 2000) + " WHERE id = 'o-1'");
    db.exec(
      "INSERT INTO pickup_tickets (order_id, token_hash, issued_at) VALUES ('o-1', 'hash-token', " + (NOW + 3000) + ")",
    );
    db.exec("UPDATE pickup_tickets SET claimed_at = " + (NOW + 4000) + " WHERE order_id = 'o-1'");
    expect(() => db.exec("UPDATE pickup_tickets SET claimed_at = " + (NOW + 5000) + " WHERE order_id = 'o-1'")).toThrow(
      /pickup_not_allowed/,
    );
  });

  test("stock adjustment di bawah reservasi ditolak", () => {
    const db = openDb();
    seed(db);
    batch(db, checkoutStatements("o-1", "v-a", 1));
    expect(() => db.exec("UPDATE variants SET stock_on_hand = 0 WHERE id = 'v-a'")).toThrow(/CHECK|stock_below_reserved/);
  });
});
