import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import {
  getAllPendingPartyRequests,
  type AdminAgencyPartyRequest,
} from '@/services/admin';

interface AdminAlertsContextValue {
  partyPending: AdminAgencyPartyRequest[];
  partyPendingCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AdminAlertsContext = createContext<AdminAlertsContextValue | null>(null);

export function AdminAlertsProvider({ children }: { children: ReactNode }) {
  const [partyPending, setPartyPending] = useState<AdminAgencyPartyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await getAllPendingPartyRequests();
      setPartyPending(list);
    } catch {
      setPartyPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const value = useMemo(
    () => ({
      partyPending,
      partyPendingCount: partyPending.length,
      loading,
      refresh,
    }),
    [partyPending, loading, refresh],
  );

  return (
    <AdminAlertsContext.Provider value={value}>
      {children}
    </AdminAlertsContext.Provider>
  );
}

export function useAdminAlerts(): AdminAlertsContextValue {
  const ctx = useContext(AdminAlertsContext);
  if (!ctx) {
    throw new Error('useAdminAlerts must be used within AdminAlertsProvider');
  }
  return ctx;
}
