"use client";

/**
 * Shared dashboard data context.
 *
 * The dashboard widgets each used to fetch their own data on mount —
 * 10+ separate requests on initial page load. This context fetches
 * /api/v1/dashboard ONCE and shares the result. Widgets read from the
 * context (zero extra fetches) and fall back to their dedicated
 * endpoint when fresh per-action state is required (signed actions
 * that mutate state).
 *
 * Refetch cadence: every 45s for ambient freshness. Widgets can also
 * call `refresh()` after a signed action to force an immediate update.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export interface DashboardPrefs {
  auto_protect: boolean;
  auto_repay: boolean;
  notify_deposits: boolean;
  notify_loan_warnings: boolean;
  notify_liquidations: boolean;
  notify_health: boolean;
}

export interface DashboardWallet {
  id: number;
  public_key: string;
  source: string;
  is_active: boolean;
  managed: boolean;
  created_at: string;
}

export interface DashboardBucket {
  lifetime: string;
  paid: string;
  pending: string;
}

export interface DashboardData {
  linked: boolean;
  telegram_username?: string | null;
  active_custodial_wallet?: string | null;
  prefs?: DashboardPrefs;
  site_lock?: { locked: boolean; until: string | null };
  wallets?: DashboardWallet[];
  tickets?: { open: number; awaiting_user: number };
  recent_activity?: Array<Record<string, unknown>>;
  earnings?: {
    referral: DashboardBucket;
    holder: DashboardBucket;
    lp: DashboardBucket;
  };
  global_site?: {
    disabled: boolean;
    reason: string | null;
    announcement: { message: string; severity: string; expires_at: string | null } | null;
  };
}

interface DashboardContextValue {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

const REFRESH_INTERVAL_MS = 45_000;

export function DashboardProvider({
  botApiUrl,
  children,
}: {
  botApiUrl: string;
  children: ReactNode;
}) {
  const { publicKey } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!walletStr || !botApiUrl) return;
    setLoading(true);
    try {
      const r = await fetch(`${botApiUrl}/api/v1/dashboard?wallet=${walletStr}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as DashboardData;
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [walletStr, botApiUrl]);

  useEffect(() => {
    if (!walletStr) return;
    fetchOnce();
    const id = setInterval(fetchOnce, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [walletStr, fetchOnce]);

  const value = useMemo(
    () => ({ data, loading, error, refresh: fetchOnce }),
    [data, loading, error, fetchOnce],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

/**
 * Read the shared dashboard data. Returns null if the provider isn't
 * mounted (e.g. component used outside the dashboard tree).
 */
export function useDashboardData(): DashboardContextValue | null {
  return useContext(DashboardContext);
}
