/**
 * Thin client for the POCER v1 API.
 * Customer endpoints use a Bearer JWT stored in localStorage.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
  "http://localhost:8080/api/v1";

const TOKEN_KEY = "pocer.token";

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

type Options = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

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
  } catch (e) {
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
    // Expired/invalid session → drop token and redirect to login.
    if (res.status === 401 && auth && typeof window !== "undefined") {
      setToken(null);
      window.localStorage.removeItem("pocer.user");
      if (!window.location.pathname.startsWith("/masuk")) {
        window.location.replace("/masuk");
      }
    }
    // Backend error envelope: { error: { code, message, details } }.
    // Also tolerate { message } or a plain string.
    const env = data && typeof data === "object" ? (data.error ?? data) : null;
    let msg: unknown =
      env?.message ??
      (typeof data === "string" && data ? data : null) ??
      `Terjadi kesalahan (${res.status})`;
    // Validation errors arrive as an array of strings.
    if (Array.isArray(msg)) msg = msg.join(", ");
    else if (Array.isArray(env?.details) && (!env?.message || msg === env?.message)) {
      // surface validation details if message is generic
      const det = env.details.filter((d: unknown) => typeof d === "string");
      if (det.length) msg = det.join(", ");
    }
    throw new ApiError(String(msg), res.status);
  }

  return data as T;
}

// ───────────────── Types ─────────────────

export type AuthResult = {
  customer: { id: number; name: string | null; username?: string | null; phone: string };
  accessToken: string;
  tokenType?: string;
};

export type Wallet = {
  currency: string;
  balance: number;
  held: number;
  available: number;
};

export type ServerLocation = {
  id: number;
  code: string;
  name: string;
  dnsName?: string | null;
  sortOrder?: number;
  latitude?: number | null;
  longitude?: number | null;
  serviceRadiusKm?: number | null;
};

export type Pkg = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  originalPrice?: number | null;
  promoLabel?: string | null;
  bonusLabel?: string | null;
  isFlashSale?: boolean;
  duration: string;
  dataLimit?: string | null;
  mikrotikProfile: string;
  isActive: boolean;
  color?: string | null;
  serverId?: number | null;
  server?: { id: number; code: string; name: string } | null;
};

export type VoucherInbox = {
  id: number;
  username: string;
  password: string;
  profile: string | null;
  activatedAt: string | null;
  expiryDate: string | null;
  // NOT_ACTIVATED until first login at the router; then ACTIVE / EXPIRED.
  validityStatus?: "NOT_ACTIVATED" | "ACTIVE" | "EXPIRED";
  isActive: boolean;
  createdAt: string;
  package: { name: string; duration: string } | null;
  paymentMethod: string;
};

export type WalletPurchaseResult = {
  reference: string;
  status: "COMPLETED";
  voucher: VoucherInbox | null;
  balance: Wallet;
};

export type QrisResult = {
  reference: string;
  status: string;
  package?: { id: number; name: string };
  payment: {
    originalAmount: number;
    totalAmount: number;
    qrUrl: string;
    expiresAt: string;
  };
};

// ───────────────── Calls ─────────────────

export type Provider = { id: number; name: string };
export type CustomerProfile = {
  id: number;
  name: string | null;
  username: string | null;
  phone: string;
  status: string;
  provider: Provider | null;
};

export const auth = {
  providers: () =>
    api<{ providers: Provider[] }>("/customer/auth/providers", { auth: false }).then((r) => r.providers),
  register: (input: { name?: string; username: string; phone: string; password: string; providerId: number }) =>
    api<AuthResult>("/customer/auth/register", { method: "POST", body: input, auth: false }),
  login: (input: { login: string; password: string }) =>
    api<AuthResult>("/customer/auth/login", { method: "POST", body: input, auth: false }),
};

export const catalog = {
  servers: () => api<ServerLocation[]>("/catalog/servers", { auth: false }),
  packages: (serverId?: number) =>
    api<Pkg[]>(`/catalog/packages${serverId ? `?server=${serverId}` : ""}`, { auth: false }),
};

function purchase(packageId: number, payWith: "balance"): Promise<WalletPurchaseResult>;
function purchase(packageId: number, payWith: "qris"): Promise<QrisResult>;
function purchase(packageId: number, payWith: "balance" | "qris") {
  return api("/customer/purchase", { method: "POST", body: { packageId, payWith } });
}

export const customer = {
  outlets: () => api<ServerLocation[]>("/customer/outlets"),
  wallet: () => api<Wallet>("/customer/wallet"),
  transactions: (limit = 50) => api<any[]>(`/customer/wallet/transactions?limit=${limit}`),
  vouchers: () => api<VoucherInbox[]>("/customer/vouchers"),
  topup: (amount: number) => api<QrisResult>("/customer/topup", { method: "POST", body: { amount } }),
  me: () => api<CustomerProfile>("/customer/me"),
  setProvider: (providerId: number) =>
    api<CustomerProfile>("/customer/provider", { method: "PUT", body: { providerId } }),
  purchase,
};

export const orders = {
  status: (reference: string) => api<any>(`/orders/${reference}/status`),
};

/** Demo only: simulate paying a QRIS order (works when backend runs in dev/sim). */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const demo = {
  pay: (reference: string) =>
    api<any>(`/payments/sim/pay/${reference}`, { method: "POST", auth: false }),
};
