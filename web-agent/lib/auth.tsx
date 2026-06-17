"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, setToken, getToken, type Role } from "./api";

export type Session = {
  role: Role;
  id: number;
  name: string;
  username: string | null;
};

type AuthState = {
  ready: boolean;
  session: Session | null;
  loginOwner: (login: string, password: string) => Promise<void>;
  loginAgent: (login: string, password: string) => Promise<void>;
  logout: () => void;
};

const SESSION_KEY = "mascafi.internal.session";
const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      const token = getToken();
      if (raw && token) setSession(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const persist = useCallback((s: Session, token: string) => {
    setToken(token);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
  }, []);

  const loginOwner = useCallback(
    async (login: string, password: string) => {
      const r = await authApi.ownerLogin({ login, password });
      persist({ role: "owner", id: r.admin.id, name: r.admin.name, username: r.admin.username }, r.accessToken);
    },
    [persist],
  );

  const loginAgent = useCallback(
    async (login: string, password: string) => {
      const r = await authApi.agentLogin({ login, password });
      persist(
        { role: "agent", id: r.agent.id, name: r.agent.name, username: r.agent.username ?? null },
        r.accessToken,
      );
    },
    [persist],
  );

  const logout = useCallback(() => {
    setToken(null);
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ ready, session, loginOwner, loginAgent, logout }),
    [ready, session, loginOwner, loginAgent, logout],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
