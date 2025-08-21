import * as React from "react";

export function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent("persisted-state:" + key));
    } catch (e) {
      console.error("[usePersistedState] Persist error", e);
    }
  }, [key, state]);

  React.useEffect(() => {
    const onSync = () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) setState(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener("persisted-state:" + key, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener("persisted-state:" + key, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, [key]);

  return [state, setState] as const;
}
