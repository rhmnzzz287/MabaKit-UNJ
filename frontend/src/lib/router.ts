import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function navigate(to: string): void {
  window.history.pushState({}, "", to);
  for (const listener of listeners) listener();
  window.scrollTo({ top: 0 });
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}
