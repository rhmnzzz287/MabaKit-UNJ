import { useEffect, useSyncExternalStore } from "react";
import { get, type Portal } from "./api";
import type { SessionInfo, User } from "./types";

export type WorkspaceRole = "buyer" | "staff" | "admin";

export type AuthSnapshot = {
  state: "loading" | "ready" | "error";
  role: WorkspaceRole | null;
  user: User | null;
  error: string | null;
};

const initial = (): AuthSnapshot => ({ state: "loading", role: null, user: null, error: null });

const snapshots: Record<Portal, AuthSnapshot> = { buyer: initial(), operator: initial() };
const listeners: Record<Portal, Set<() => void>> = { buyer: new Set(), operator: new Set() };
/** Nomor versi request terakhir per portal; respons dari versi lama dibuang agar sesi tamu tidak memulihkan state. */
const requested: Record<Portal, number> = { buyer: 0, operator: 0 };

function emit(portal: Portal): void {
  for (const listener of listeners[portal]) listener();
}

export function authSnapshot(portal: Portal): AuthSnapshot {
  return snapshots[portal];
}

export function subscribeAuth(portal: Portal, listener: () => void): () => void {
  listeners[portal].add(listener);
  return () => listeners[portal].delete(listener);
}

function store(portal: Portal, next: AuthSnapshot): AuthSnapshot {
  snapshots[portal] = next;
  emit(portal);
  return next;
}

export function setAuth(portal: Portal, info: SessionInfo): void {
  store(portal, { state: "ready", role: info.role, user: info.user, error: null });
}

/** Tiap panggilan selalu fetch baru; hanya respons dari request terakhir yang dipakai. */
export async function refreshAuth(portal: Portal = "buyer"): Promise<AuthSnapshot> {
  const version = ++requested[portal];
  if (snapshots[portal].state !== "ready") store(portal, { ...snapshots[portal], state: "loading" });
  const suffix = portal === "operator" ? "?portal=operator" : "";
  try {
    const body = await get<SessionInfo>(`/api/auth/session${suffix}`);
    if (version !== requested[portal]) return snapshots[portal];
    return store(portal, { state: "ready", role: body.role, user: body.user, error: null });
  } catch (issue: unknown) {
    if (version !== requested[portal]) return snapshots[portal];
    return store(portal, {
      state: "error",
      role: null,
      user: null,
      error: issue instanceof Error ? issue.message : "Sesi gagal diperiksa.",
    });
  }
}

export function useAuth(portal: Portal = "buyer"): AuthSnapshot {
  return useSyncExternalStore(
    (listener) => subscribeAuth(portal, listener),
    () => authSnapshot(portal),
    () => authSnapshot(portal),
  );
}

/** Fokus/visibilitas memicu pemeriksaan ulang supaya tab lain tidak meninggalkan state basi. */
export function useAuthRevalidation(): void {
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "visible") {
        void refreshAuth("buyer");
        void refreshAuth("operator");
      }
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, []);
}
