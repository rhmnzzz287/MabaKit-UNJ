export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)mbk_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET") headers.set("x-csrf", csrfToken());
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      typeof body.error === "string" ? body.error : "internal",
      typeof body.message === "string" ? body.message : "Terjadi kesalahan.",
      response.status,
    );
  }
  return body as T;
}

export async function ensureSession(): Promise<void> {
  if (csrfToken()) return;
  await raw<{ csrfToken: string }>("/api/demo/session", { method: "POST" });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await raw<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError && error.code === "session_required") {
      await ensureSession();
      return raw<T>(path, init);
    }
    throw error;
  }
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
