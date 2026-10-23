import { refreshAuth, useAuth, type AuthSnapshot, type WorkspaceRole } from "./auth-store";

export type Workspace = AuthSnapshot & { reload: () => void };

/** Role dan akun dibaca dari server melalui satu snapshot per portal. */
export function useWorkspace(portal: "buyer" | "operator" = "buyer"): Workspace {
  const snapshot = useAuth(portal);
  return { ...snapshot, reload: () => void refreshAuth(portal) };
}

/** Portal operator memakai cookie sendiri; sesi pembeli tidak pernah cukup di sini. */
export function useOperatorWorkspace(): Workspace {
  return useWorkspace("operator");
}

const BUYER_NEXT = /^\/(cart|checkout|orders|profile)(\/|$)/;
const OPERATOR_NEXT = /^\/(team|admin)(\/|$)/;
const ADMIN_NEXT = /^\/admin(\/|$)/;

function internal(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\") || raw.includes("..") || raw.includes("\n") || raw.includes("\r")) return null;
  return raw;
}

/** Hanya tujuan internal portal yang diizinkan boleh dipakai setelah login. */
export function safeNext(raw: string | null, fallback = "/orders"): string {
  const path = internal(raw);
  return path && BUYER_NEXT.test(path) ? path : fallback;
}

/** Tujuan operator baru ditentukan setelah server memverifikasi role. */
export function operatorNext(raw: string | null, role: "staff" | "admin"): string {
  const path = internal(raw);
  const allowed = path && OPERATOR_NEXT.test(path) ? path : null;
  if (role === "admin") return allowed ?? "/admin";
  return allowed && !ADMIN_NEXT.test(allowed) ? allowed : "/team/orders";
}

export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export type { WorkspaceRole };
