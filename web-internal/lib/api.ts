/**
 * Thin client for the POCER v1 API — Internal app (Owner + Agent).
 * A single Bearer JWT is stored in localStorage; the active role decides which
 * endpoints are used. Owners log in via /admin/auth/login (actor=admin),
 * agents via /auth/login (actor=agent).
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8080/api/v1";

const TOKEN_KEY = "pocer.internal.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError("Tidak bisa terhubung ke server. Cek koneksi.", 0);
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const env = data && typeof data === "object" ? (data.error ?? data) : null;
    let msg: unknown =
      env?.message ??
      (typeof data === "string" && data ? data : null) ??
      `Terjadi kesalahan (${res.status})`;
    if (Array.isArray(msg)) msg = msg.join(", ");
    else if (Array.isArray(env?.details) && (!env?.message || msg === env?.message)) {
      const det = env.details.filter((d: unknown) => typeof d === "string");
      if (det.length) msg = det.join(", ");
    }
    throw new ApiError(String(msg), res.status);
  }

  return data as T;
}

// ───────────────── Types ─────────────────

export type Role = "owner" | "agent";

export type OwnerProfile = {
  id: number;
  name: string;
  username: string;
  phone: string | null;
  status: string;
  agentCount: number;
  outletCount: number;
};

export type AgentProfile = {
  id: number;
  name: string;
  username: string | null;
  phone: string;
  status: string;
  hasPin: boolean;
  owner: { id: number; name: string } | null;
  balance: number;
  outlets: Outlet[];
};

export type Outlet = { id: number; code: string; name: string };

export type OwnerOutlet = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  hasRouter: boolean;
  packageCount: number;
};

export type OwnerPackage = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  agentPrice: number | null;
  duration: string;
  mikrotikProfile: string;
  isActive: boolean;
  originalPrice: number | null;
  promoLabel: string | null;
  bonusLabel: string | null;
  isFlashSale: boolean;
  server: Outlet | null;
};

export type AgentPkg = {
  id: number;
  name: string;
  price: number;
  agentPrice: number;
  duration: string;
  isActive: boolean;
  server: Outlet | null;
};

export type AgentRow = {
  id: number;
  name: string;
  username: string | null;
  phone: string;
  status: string;
  balance: number;
  outlets: Outlet[];
};

export type AgentDetail = AgentRow & { hasPin: boolean };

export type CustomerRow = {
  id: number;
  name: string | null;
  username: string | null;
  phone: string;
  status: string;
  balance: number;
};

export type Wallet = { currency: string; balance: number; held: number; available: number };

export type Ledger = {
  id: number;
  direction: "CREDIT" | "DEBIT";
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
};

export type Reports = {
  totals: { orders: number; revenue: number };
  byOutlet: { server: Outlet; orders: number; revenue: number }[];
  byAgent: { agent: { id: number; name: string; username: string | null }; orders: number; revenue: number }[];
};

export type SellResult = {
  reference: string;
  status: string;
  deliveredTo?: number;
  voucher: {
    id: number;
    username: string;
    password: string;
    profile: string | null;
    expiryDate: string | null;
  } | null;
  agentBalance?: Wallet;
};

export type QrisResult = {
  reference: string;
  status: string;
  payment: { originalAmount: number; totalAmount: number; qrUrl: string; expiresAt: string };
};

// ───────────────── Auth ─────────────────

export type OwnerLoginResult = {
  admin: { id: number; name: string; username: string; phone: string | null };
  accessToken: string;
};
export type AgentLoginResult = {
  agent: { id: number; name: string; phone: string; username: string | null };
  accessToken: string;
};

export const authApi = {
  ownerLogin: (input: { login: string; password: string }) =>
    api<OwnerLoginResult>("/admin/auth/login", { method: "POST", body: input, auth: false }),
  agentLogin: (input: { login: string; password: string }) =>
    api<AgentLoginResult>("/auth/login", { method: "POST", body: input, auth: false }),
};

// ───────────────── Owner ─────────────────

export const owner = {
  me: () => api<OwnerProfile>("/admin/me"),
  outlets: () => api<OwnerOutlet[]>("/admin/outlets"),
  packages: (serverId?: number) =>
    api<OwnerPackage[]>(`/admin/packages${serverId ? `?server=${serverId}` : ""}`),
  updatePackage: (
    id: number,
    body: Partial<{
      name: string;
      description: string;
      price: number;
      agentPrice: number;
      isActive: boolean;
      originalPrice: number;
      promoLabel: string;
      bonusLabel: string;
      isFlashSale: boolean;
    }>,
  ) => api<any>(`/admin/packages/${id}`, { method: "PATCH", body }),
  customers: (search?: string) =>
    api<CustomerRow[]>(`/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  topupCustomer: (body: { customerId?: number; phone?: string; amount: number; note?: string }) =>
    api<any>("/admin/customers/topup", { method: "POST", body }),
  reports: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    return api<Reports>(`/admin/reports${s ? `?${s}` : ""}`);
  },
  agents: {
    list: () => api<AgentRow[]>("/admin/agents"),
    get: (id: number) => api<AgentDetail>(`/admin/agents/${id}`),
    create: (body: {
      name: string;
      phone: string;
      username?: string;
      password: string;
      pin?: string;
      serverIds?: number[];
    }) => api<any>("/admin/agents", { method: "POST", body }),
    update: (
      id: number,
      body: Partial<{ name: string; password: string; pin: string; status: "ACTIVE" | "SUSPENDED" }>,
    ) => api<any>(`/admin/agents/${id}`, { method: "PATCH", body }),
    assignOutlets: (id: number, serverIds: number[]) =>
      api<any>(`/admin/agents/${id}/outlets`, { method: "POST", body: { serverIds } }),
  },
};

// ───────────────── Agent ─────────────────

export const agent = {
  me: () => api<AgentProfile>("/agent/me"),
  outlets: () => api<(Outlet & { isActive: boolean })[]>("/agent/outlets"),
  packages: (serverId?: number) =>
    api<AgentPkg[]>(`/agent/packages${serverId ? `?server=${serverId}` : ""}`),
  wallet: () => api<Wallet>("/wallet"),
  transactions: (limit = 50) => api<Ledger[]>(`/wallet/transactions?limit=${limit}`),
  topup: (amount: number) => api<QrisResult>("/agent/topup", { method: "POST", body: { amount } }),
  sellToCustomer: (body: { customerId: number; packageId: number; pin?: string }) =>
    api<SellResult>("/agent/sell-to-customer", { method: "POST", body }),
  sellToWhatsapp: (body: { packageId: number; customerWhatsapp: string; pin?: string }) =>
    api<SellResult>("/agent/purchase", { method: "POST", body }),
};

export const orders = {
  status: (reference: string) => api<any>(`/orders/${reference}/status`),
};

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const demo = {
  pay: (reference: string) =>
    api<any>(`/payments/sim/pay/${reference}`, { method: "POST", auth: false }),
};
