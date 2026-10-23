export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string;

  constructor(code: string, message: string, status: number, field?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.field = field;
  }
}

export type Portal = "buyer" | "operator";

const COOKIE = {
  buyer: { token: "mbk_sess", csrf: "mbk_csrf" },
  operator: { token: "mbk_op_sess", csrf: "mbk_op_csrf" },
} as const;

function csrfToken(portal: Portal): string {
  const name = COOKIE[portal].csrf;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

/** Endpoint operator memakai cookie portal operator; endpoint publik tetap buyer. */
function portalFor(path: string): Portal {
  return /^\/api\/(team|admin|staff)(\/|$)/.test(path) ? "operator" : "buyer";
}

async function raw<T>(path: string, init: RequestInit = {}, portal: Portal = portalFor(path)): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET") headers.set("x-csrf", csrfToken(portal));
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      typeof body.error === "string" ? body.error : "internal",
      typeof body.message === "string" ? body.message : "Terjadi kesalahan.",
      response.status,
      typeof body.field === "string" ? body.field : undefined,
    );
  }
  return body as T;
}

async function createGuestSession(portal: Portal): Promise<void> {
  await raw<{ csrfToken: string }>("/api/demo/session", {
    method: "POST",
    body: JSON.stringify({ portal }),
  });
}

export async function ensureSession(force = false, portal: Portal = "buyer"): Promise<void> {
  const suffix = portal === "operator" ? "?portal=operator" : "";
  if (force) {
    await createGuestSession(portal);
    return;
  }
  if (!csrfToken(portal)) {
    await createGuestSession(portal);
    return;
  }
  const current = await raw<{ session: { expiresAt: number } | null }>(`/api/auth/session${suffix}`, {}, portal);
  if (!current.session) await createGuestSession(portal);
}

/**
 * Masuk/daftar: pastikan sesi anonim hidup lebih dulu. Bila server menolak
 * sesi yang baru kedaluwarsa, buat sesi anonim baru lalu ulangi sekali.
 * Hanya dipakai untuk login, tidak untuk transaksi akun.
 */
export async function authenticate<T>(path: string, body: unknown, portal: Portal = "buyer"): Promise<T> {
  await ensureSession(false, portal);
  try {
    return await raw<T>(path, { method: "POST", body: JSON.stringify(body) }, portal);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "session_required") throw error;
    await ensureSession(true, portal);
    return raw<T>(path, { method: "POST", body: JSON.stringify(body) }, portal);
  }
}

export const api = raw;

export const get = <T>(path: string) => raw<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  raw<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => raw<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => raw<T>(path, { method: "PUT", body: JSON.stringify(body) });

/** Mutasi portal operator, termasuk logout yang harus memakai cookie operator. */
export const opPost = <T>(path: string, body?: unknown) =>
  raw<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, "operator");
export const opGet = <T>(path: string) => raw<T>(path, {}, "operator");
export const opPatch = <T>(path: string, body: unknown) =>
  raw<T>(path, { method: "PATCH", body: JSON.stringify(body) }, "operator");
export const del = <T>(path: string) => raw<T>(path, { method: "DELETE" }, "operator");

/** Unggah biner ke endpoint operator; bukan JSON. */
export async function upload<T>(path: string, file: File): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": file.type, "x-csrf": csrfToken("operator") },
    body: file,
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      typeof body.error === "string" ? body.error : "internal",
      typeof body.message === "string" ? body.message : "Terjadi kesalahan.",
      response.status,
      typeof body.field === "string" ? body.field : undefined,
    );
  }
  return body as T;
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}
