import { type Ctx, type OperatorRow, fail } from "./http";

type Row = {
  order_number: string;
  invoice_number: string | null;
  paid_at: number;
  faculty_name: string | null;
  method: string;
  subtotal_rp: number;
  total_rp: number;
};

const HEADER = ["invoice", "pesanan", "dibayar_wib", "fakultas", "metode", "subtotal_rp", "diskon_rp", "total_rp"];

/** Cegah formula injection di spreadsheet: sel yang diawali = + - @ diberi apostrof. */
export function csvCell(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function wib(epochMs: number): string {
  return new Date(epochMs + 7 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");
}

function dayStart(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00+07:00`);
  return Number.isFinite(ms) ? ms : null;
}

export async function adminExportSales(ctx: Ctx, _operator: OperatorRow): Promise<Response> {
  const url = new URL(ctx.request.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = fromRaw ? dayStart(fromRaw) : null;
  const to = toRaw ? dayStart(toRaw) : null;
  if ((fromRaw && from === null) || (toRaw && to === null)) return fail("invalid_payload");
  if (from !== null && to !== null && to < from) return fail("invalid_payload");

  const conditions = ["o.payment_status = 'PAID'", "o.paid_at IS NOT NULL"];
  const params: (number | string)[] = [];
  if (from !== null) {
    conditions.push("o.paid_at >= ?");
    params.push(from);
  }
  if (to !== null) {
    conditions.push("o.paid_at < ?");
    params.push(to + 86_400_000);
  }

  const lines = [HEADER.join(",")];
  let cursor: { t: number; i: string } | null = null;
  for (;;) {
    const limit = 500;
    const where = [...conditions];
    const bound = [...params];
    if (cursor) {
      where.push("(o.paid_at > ? OR (o.paid_at = ? AND o.id > ?))");
      bound.push(cursor.t, cursor.t, cursor.i);
    }
    const { results } = await ctx.env.DB.prepare(
      // Subtotal dari snapshot item: orders.total_rp disimpan minimal 1 karena constraint lama.
      `SELECT o.id, o.order_number, o.paid_at,
              COALESCE((SELECT SUM(oi.base_unit_price_rp * oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS subtotal_rp,
              o.amount_due_rp AS total_rp,
              i.invoice_number, f.name AS faculty_name, p.method
       FROM orders o
       LEFT JOIN invoices i ON i.order_id = o.id
       LEFT JOIN faculties f ON f.id = o.faculty_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE ${where.join(" AND ")}
       ORDER BY o.paid_at, o.id
       LIMIT ${limit}`,
    )
      .bind(...bound)
      .all<Row & { id: string }>();
    for (const row of results) {
      lines.push(
        [
          row.invoice_number,
          row.order_number,
          wib(row.paid_at),
          row.faculty_name,
          row.method,
          row.subtotal_rp,
          row.subtotal_rp - row.total_rp,
          row.total_rp,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    if (results.length < limit) break;
    const last = results[results.length - 1];
    cursor = { t: last.paid_at, i: last.id };
  }

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="penjualan-mabakit.csv"',
      "cache-control": "no-store",
    },
  });
}
