import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = InstanceType<typeof DatabaseSync>;

type Row = Record<string, unknown>;

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../db/migrations");

function migrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => path.join(MIGRATIONS_DIR, name));
}

function isReadStatement(sql: string): boolean {
  const head = sql.trim().toUpperCase();
  return head.startsWith("SELECT") || head.startsWith("WITH") || head.includes(" RETURNING ");
}

class Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): Statement {
    return new Statement(this.db, this.sql, params);
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...(this.params as never[])) as Row | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T = Row>(): Promise<{ results: T[]; success: true; meta: { changes: number } }> {
    const statement = this.db.prepare(this.sql);
    const results = (isReadStatement(this.sql) ? statement.all(...(this.params as never[])) : []) as T[];
    let changes = 0;
    if (!isReadStatement(this.sql)) {
      const run = statement.run(...(this.params as never[]));
      changes = Number(run.changes);
    }
    return { results, success: true, meta: { changes } };
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    const run = this.db.prepare(this.sql).run(...(this.params as never[]));
    return { success: true, meta: { changes: Number(run.changes) } };
  }
}

/** D1Database tiruan di atas node:sqlite, cukup untuk menguji route (bukan pengganti staging D1). */
export class TestD1 {
  private readonly db: DatabaseSync;

  constructor(migrationPaths = migrations()) {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON;");
    for (const migrationPath of migrationPaths) this.db.exec(readFileSync(migrationPath, "utf8"));
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql);
  }

  async batch(statements: Statement[]): Promise<unknown[]> {
    this.db.exec("BEGIN");
    try {
      const out: unknown[] = [];
      for (const statement of statements) out.push(await statement.all());
      this.db.exec("COMMIT");
      return out;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  raw(): DatabaseSync {
    return this.db;
  }
}

export function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/stock_unavailable/.test(message)) return "stock_unavailable";
  if (/hold_limit/.test(message)) return "hold_limit";
  if (/rate_limited/.test(message)) return "rate_limited";
  if (/catalog_changed/.test(message)) return "catalog_changed";
  if (/not_ready_transition/.test(message)) return "not_ready_transition";
  if (/pickup_not_allowed/.test(message)) return "pickup_not_allowed";
  if (/stock_below_reserved/.test(message)) return "stock_below_reserved";
  if (/UNIQUE constraint failed/.test(message)) return "conflict";
  return "internal";
}
