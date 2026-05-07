import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl, getHealth, getInbox, isMockMode } from "../api/client";
import type { InboxItem } from "../types";

type InboxState = {
  items: InboxItem[];
  loading: boolean;
  error: string | null;
  backendOnline: boolean;
  mockMode: boolean;
  apiBaseUrl: string;
  reload: () => Promise<void>;
  addItem: (item: InboxItem) => void;
  getItem: (id: string | null) => InboxItem | undefined;
};

const InboxContext = createContext<InboxState | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, inbox] = await Promise.all([getHealth().catch(() => false), getInbox()]);
      setBackendOnline(health);
      setItems(inbox);
    } catch (err) {
      setBackendOnline(false);
      setItems([]);
      setError(err instanceof Error ? err.message : "No se pudo conectar al backend");
    } finally {
      setLoading(false);
    }
  }, []);

  const addItem = useCallback((item: InboxItem) => {
    setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo<InboxState>(
    () => ({
      items,
      loading,
      error,
      backendOnline,
      mockMode: isMockMode(),
      apiBaseUrl: getApiBaseUrl(),
      reload,
      addItem,
      getItem: (id) => (id ? items.find((entry) => entry.id === id) : undefined)
    }),
    [addItem, backendOnline, error, items, loading, reload]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const context = useContext(InboxContext);
  if (!context) throw new Error("useInbox debe usarse dentro de InboxProvider");
  return context;
}
