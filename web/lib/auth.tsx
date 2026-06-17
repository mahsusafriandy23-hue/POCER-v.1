"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth as authApi, getToken, setToken, type AuthResult } from "./api";

export type CurrentUser = { id: number; name: string | null; username?: string | null; phone: string };

type AuthState = {
  user: CurrentUser | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (input: { name?: string; username: string; phone: string; password: string; providerId: number }) => Promise<void>;
  logout: () => void;
};

const USER_KEY = "mascafi.user";
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const token = getToken();
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(USER_KEY) : null;
    if (token && raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        setUser(null);
      }
    }
    setReady(true);
  }, []);

  const persist = useCallback((res: AuthResult) => {
    setToken(res.accessToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(res.customer));
    setUser(res.customer);
  }, []);

  const login = useCallback(
    async (login: string, password: string) => {
      const res = await authApi.login({ login, password });
      persist(res);
    },
    [persist],
  );

  const register = useCallback(
    async (input: { name?: string; username: string; phone: string; password: string; providerId: number }) => {
      const res = await authApi.register(input);
      persist(res);
    },
    [persist],
  );

  const logout = useCallback(() => {
    setToken(null);
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
    router.replace("/masuk");
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
