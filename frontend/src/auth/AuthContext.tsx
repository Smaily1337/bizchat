import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/api";
import { ApiError, getToken, setToken } from "@/api/client";
import type { Business, Owner } from "@/api/types";
import { businessApi } from "@/api";

type AuthState = {
  token: string | null;
  owner: Owner | null;
  business: Business | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshBusiness: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [owner, setOwner] = useState<Owner | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async (tok: string | null) => {
    if (!tok) {
      setOwner(null);
      setBusiness(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      const biz = await businessApi.get();
      setOwner(me);
      setBusiness(biz);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
        setTokenState(null);
      }
      setOwner(null);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession(token);
  }, [token, loadSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.access_token);
    setTokenState(res.access_token);
    setLoading(true);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setOwner(null);
    setBusiness(null);
  }, []);

  const refreshBusiness = useCallback(async () => {
    const biz = await businessApi.get();
    setBusiness(biz);
  }, []);

  const value = useMemo(
    () => ({
      token,
      owner,
      business,
      loading,
      login,
      logout,
      refreshBusiness,
    }),
    [token, owner, business, loading, login, logout, refreshBusiness],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
