/**
 * Thin client for the voucher-platform API — Internal app (Owner + Agent).
 * A single Bearer JWT is stored in localStorage; the active role decides which
 * endpoints are used. Owners log in via /admin/auth/login (actor=admin),
 * agents via /auth/login (actor=agent).
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8080/api/v1";

const TOKEN_KEY = "mascafi.internal.token";

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
    // Expired/invalid session on an authenticated call → drop the token and bounce
    // to login instead of surfacing a cryptic "invalid expired token".
    if (res.status === 401 && auth && typeof window !== "undefined") {
      setToken(null);
      if (!window.location.pathname.startsWith("/masuk")) {
        window.location.replace("/masuk?expired=1");
      }
    }
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
  manageAllOutlets?: boolean;
  isOperator?: boolean;
  agentCount: number;
  outletCount: number;
};

// Operator view of a Penyedia Layanan (provider/owner account).
export type Provider = {
  id: number;
  name: string;
  brandName: string | null;
  username: string;
  phone: string | null;
  status: string;
  isOperator?: boolean;
  manageAllOutlets: boolean;
  agentCount: number;
  outletCount: number;
  outlets: { id: number; code: string; name: string }[];
  createdAt?: string;
};

export type ProviderDetail = Provider & {
  agents: { id: number; name: string; username: string | null; phone: string; status: string }[];
};

export type PlatformOutlet = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  ownerAdminId: number | null;
};

// A limited per-outlet monitoring user (asisten).
export type Assistant = {
  id: number;
  name: string;
  username: string;
  status: string;
  canSell: boolean;
  outlets: { id: number; code: string; name: string }[];
  outletCount?: number;
  createdAt?: string;
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

export type VoucherCharset = "numeric" | "alphanumeric";
export type VoucherUserMode = "USER_PASS" | "USER_EQ_PASS";

export type OwnerOutlet = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  hasRouter: boolean;
  brandId?: number | null;
  packageCount: number;
  dnsName?: string | null;
  sortOrder?: number;
  voucherCharset?: VoucherCharset;
  voucherUserMode?: VoucherUserMode;
  voucherLength?: number;
};

export type OwnerPackage = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  agentPrice: number | null;
  duration: string;
  mikrotikProfile: string;
  dataLimit: string | null;
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
  discountPercent?: number;
  balance: number;
  brand?: { id: number; name: string } | null;
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

export type CustomerVoucher = {
  id: number;
  username: string;
  password: string;
  profile: string | null;
  activatedAt: string | null;
  expiryDate: string | null;
  isActive: boolean;
  createdAt: string;
  packageName: string | null;
  duration: string | null;
};

export type CustomerDetail = CustomerRow & {
  vouchers: CustomerVoucher[];
  transactions: Ledger[];
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
  byDay: { date: string; orders: number; revenue: number }[];
  byOutlet: { server: Outlet; orders: number; revenue: number }[];
  byAgent: { agent: { id: number; name: string; username: string | null }; orders: number; revenue: number }[];
};

export type Transaction = {
  id: number;
  reference: string;
  createdAt: string;
  package: string;
  outlet: { code: string; name: string } | null;
  agent: { id: number; name: string; username: string | null } | null;
  customerWhatsapp: string;
  customerId: number | null;
  amount: number;
  fundingSource: string;
  status: string;
  fulfillStatus: string;
  voucher: string | null;
};

export type OwnerSettings = {
  profile: { name: string; brandName: string | null };
  qris: { configured: boolean; preview: string | null; merchant: string | null; nmid: string | null };
  whatsapp: { number: string | null; gatewayUrl: string | null; hasKey: boolean };
  routers: {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
    mikrotikIp: string | null;
    mikrotikPort: number;
    mikrotikUser: string | null;
    hasPassword: boolean;
    configured: boolean;
  }[];
};

export type RouterTestResult =
  | { ok: true; identity: string | null; version: string | null; board: string | null; uptime: string | null }
  | { ok: false; error: string };

export type Brand = {
  id: number;
  name: string;
  slug: string | null;
  isActive: boolean;
  outletCount: number;
  qrisCount: number;
  agentCount: number;
};

export type QrisAccount = {
  id: number;
  label: string;
  brand?: { id: number; name: string } | null;
  brandId?: number | null;
  configured: boolean;
  preview: string | null;
  merchant: string | null;
  nmid: string | null;
  isActive: boolean;
  isTopupDefault: boolean;
  paymentMode: "dynamic" | "static-amount" | "static" | null;
  paymentProvider?: string;
  bri?: { configured: boolean; merchantId: string | null; connectedAt: string | null };
  gobiz: { connected: boolean; phone: string | null; merchantId: string | null; connectedAt: string | null };
  outlets: Outlet[];
};

export type QrisOverview = {
  brands?: { id: number; name: string }[];
  accounts: QrisAccount[];
  outlets: { id: number; code: string; name: string; qrisAccountId: number | null; brandId?: number | null }[];
};

export type QrisDecoded = {
  qrisText: string;
  merchant: string | null;
  city: string | null;
  nmid: string | null;
  acquirer: string | null;
  isGobiz: boolean;
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
  updateOutlet: (
    id: number,
    body: Partial<{ name: string; dnsName: string; isActive: boolean; sortOrder: number; brandId: number }>,
  ) => api<any>(`/admin/outlets/${id}`, { method: "PATCH", body }),
  createOutlet: (body: { code: string; name: string; dnsName?: string; sortOrder?: number; brandId?: number }) =>
    api<OwnerOutlet>("/admin/outlets", { method: "POST", body }),
  updateVoucherFormat: (
    id: number,
    body: Partial<{ voucherCharset: VoucherCharset; voucherUserMode: VoucherUserMode; voucherLength: number }>,
  ) => api<any>(`/admin/outlets/${id}/voucher-format`, { method: "PUT", body }),
  packages: (serverId?: number) =>
    api<OwnerPackage[]>(`/admin/packages${serverId ? `?server=${serverId}` : ""}`),
  createPackage: (body: {
    serverId: number;
    name: string;
    description?: string;
    price: number;
    agentPrice?: number;
    duration: string;
    mikrotikProfile?: string;
    dataLimit?: string;
    isActive?: boolean;
    originalPrice?: number;
    promoLabel?: string;
    bonusLabel?: string;
    isFlashSale?: boolean;
  }) => api<any>("/admin/packages", { method: "POST", body }),
  deletePackage: (id: number) => api<any>(`/admin/packages/${id}`, { method: "DELETE" }),
  updatePackage: (
    id: number,
    body: Partial<{
      name: string;
      description: string;
      price: number;
      agentPrice: number;
      isActive: boolean;
      duration: string;
      mikrotikProfile: string;
      dataLimit: string;
      originalPrice: number;
      promoLabel: string;
      bonusLabel: string;
      isFlashSale: boolean;
    }>,
  ) => api<any>(`/admin/packages/${id}`, { method: "PATCH", body }),
  settings: () => api<OwnerSettings>("/admin/settings"),
  updateProfile: (body: { brandName?: string }) =>
    api<{ ok: true }>("/admin/settings/profile", { method: "PUT", body }),
  updateQris: (body: { qrisText?: string; qrisMerchant?: string; qrisNmid?: string }) =>
    api<{ ok: true }>("/admin/settings/qris", { method: "PUT", body }),
  brands: {
    list: () => api<Brand[]>("/admin/brands"),
    create: (body: { name: string; slug?: string }) =>
      api<{ id: number; name: string; slug: string | null }>("/admin/brands", { method: "POST", body }),
    update: (id: number, body: Partial<{ name: string; slug: string; isActive: boolean; sortOrder: number }>) =>
      api<{ ok: true }>(`/admin/brands/${id}`, { method: "PATCH", body }),
  },
  qris: {
    list: () => api<QrisOverview>("/admin/qris"),
    create: (body: { label: string; qrisText?: string; merchant?: string; nmid?: string; brandId?: number }) =>
      api<{ id: number; label: string }>("/admin/qris", { method: "POST", body }),
    update: (
      id: number,
      body: Partial<{ label: string; brandId: number; qrisText: string; merchant: string; nmid: string; isActive: boolean; isTopupDefault: boolean; paymentMode: "dynamic" | "static-amount" | "static" }>,
    ) => api<{ ok: true }>(`/admin/qris/${id}`, { method: "PUT", body }),
    remove: (id: number) => api<{ ok: true }>(`/admin/qris/${id}`, { method: "DELETE" }),
    assignOutlets: (id: number, serverIds: number[]) =>
      api<{ ok: true; assigned: number }>(`/admin/qris/${id}/outlets`, { method: "PUT", body: { serverIds } }),
    gobiz: {
      login: (id: number, body: { identifier: string; password: string }) =>
        api<{ ok: boolean; connected?: boolean; merchantId?: string | null; otpRequired?: boolean; message?: string }>(
          `/admin/qris/${id}/gobiz/login`,
          { method: "POST", body },
        ),
      requestOtp: (id: number, phone: string) =>
        api<{ ok: true; otpToken: string }>(`/admin/qris/${id}/gobiz/request-otp`, { method: "POST", body: { phone } }),
      verifyOtp: (id: number, body: { otpToken: string; otp: string; phone?: string }) =>
        api<{ ok: true; connected: boolean; merchantId: string | null }>(`/admin/qris/${id}/gobiz/verify-otp`, { method: "POST", body }),
      connectRefreshToken: (id: number, refreshToken: string) =>
        api<{ ok: true; connected: boolean; merchantId: string | null }>(`/admin/qris/${id}/gobiz/refresh-token`, { method: "POST", body: { refreshToken } }),
      disconnect: (id: number) => api<{ ok: true }>(`/admin/qris/${id}/gobiz`, { method: "DELETE" }),
    },
    // Multipart upload — bypasses the JSON api() helper to send FormData.
    decode: async (file: File): Promise<QrisDecoded> => {
      const form = new FormData();
      form.append("file", file);
      const token = getToken();
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/admin/qris/decode`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
      } catch {
        throw new ApiError("Tidak bisa terhubung ke server. Cek koneksi.", 0);
      }
      const txt = await res.text();
      let data: any = null;
      if (txt) {
        try {
          data = JSON.parse(txt);
        } catch {
          data = txt;
        }
      }
      if (!res.ok) {
        const env = data && typeof data === "object" ? (data.error ?? data) : null;
        let msg: unknown = env?.message ?? `Gagal membaca QRIS (${res.status})`;
        if (Array.isArray(msg)) msg = msg.join(", ");
        throw new ApiError(String(msg), res.status);
      }
      return data as QrisDecoded;
    },
  },
  updateWhatsapp: (body: {
    waNumber?: string;
    waGatewayUrl?: string;
    waGatewayKey?: string;
    clearKey?: boolean;
  }) => api<{ ok: true }>("/admin/settings/whatsapp", { method: "PUT", body }),
  updateRouter: (
    id: number,
    body: {
      mikrotikIp?: string;
      mikrotikPort?: number;
      mikrotikUser?: string;
      mikrotikPass?: string;
      clear?: boolean;
    },
  ) => api<{ ok: true; configured: boolean }>(`/admin/outlets/${id}/router`, { method: "PUT", body }),
  testRouter: (id: number) =>
    api<RouterTestResult>(`/admin/outlets/${id}/router/test`, { method: "POST" }),
  routerProfiles: (id: number) =>
    api<{ ok: boolean; profiles: string[]; error?: string }>(`/admin/outlets/${id}/router/profiles`),
  customers: (search?: string) =>
    api<CustomerRow[]>(`/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createCustomer: (body: { name: string; phone: string; username?: string; password: string }) =>
    api<CustomerRow>("/admin/customers", { method: "POST", body }),
  getCustomer: (id: number) => api<CustomerDetail>(`/admin/customers/${id}`),
  updateCustomer: (
    id: number,
    body: Partial<{ name: string; phone: string; username: string; status: string; password: string }>,
  ) => api<CustomerRow>(`/admin/customers/${id}`, { method: "PATCH", body }),
  deleteCustomer: (id: number) => api<{ ok: boolean }>(`/admin/customers/${id}`, { method: "DELETE" }),
  topupCustomer: (body: { customerId?: number; phone?: string; amount: number; note?: string }) =>
    api<any>("/admin/customers/topup", { method: "POST", body }),
  reports: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    return api<Reports>(`/admin/reports${s ? `?${s}` : ""}`);
  },
  transactions: (opts: { search?: string; status?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.search) q.set("search", opts.search);
    if (opts.status) q.set("status", opts.status);
    if (opts.limit) q.set("limit", String(opts.limit));
    const s = q.toString();
    return api<Transaction[]>(`/admin/transactions${s ? `?${s}` : ""}`);
  },
  deleteTransactions: (ids: number[]) =>
    api<{ deleted: number }>("/admin/transactions", { method: "DELETE", body: { ids } }),
  agents: {
    list: () => api<AgentRow[]>("/admin/agents"),
    get: (id: number) => api<AgentDetail>(`/admin/agents/${id}`),
    create: (body: {
      name: string;
      phone: string;
      username?: string;
      password: string;
      pin?: string;
      discountPercent?: number;
      brandId?: number;
      serverIds?: number[];
    }) => api<any>("/admin/agents", { method: "POST", body }),
    update: (
      id: number,
      body: Partial<{
        name: string;
        password: string;
        pin: string;
        status: "ACTIVE" | "SUSPENDED";
        discountPercent: number;
        brandId: number;
      }>,
    ) => api<any>(`/admin/agents/${id}`, { method: "PATCH", body }),
    remove: (id: number) => api<{ ok: true }>(`/admin/agents/${id}`, { method: "DELETE" }),
    assignOutlets: (id: number, serverIds: number[]) =>
      api<any>(`/admin/agents/${id}/outlets`, { method: "POST", body: { serverIds } }),
    topup: (id: number, body: { amount: number; note?: string }) =>
      api<any>(`/admin/agents/${id}/topup`, { method: "POST", body }),
  },
  // Operator-only: manage Penyedia Layanan (other providers/owners).
  providers: {
    list: () => api<Provider[]>("/admin/providers"),
    outlets: () => api<PlatformOutlet[]>("/admin/providers/outlets"),
    get: (id: number) => api<ProviderDetail>(`/admin/providers/${id}`),
    create: (body: {
      name: string;
      brandName?: string;
      username: string;
      password: string;
      phone?: string;
      manageAllOutlets?: boolean;
    }) => api<any>("/admin/providers", { method: "POST", body }),
    update: (
      id: number,
      body: Partial<{
        name: string;
        brandName: string;
        phone: string;
        password: string;
        status: "ACTIVE" | "SUSPENDED";
        manageAllOutlets: boolean;
      }>,
    ) => api<any>(`/admin/providers/${id}`, { method: "PATCH", body }),
    assignOutlets: (id: number, serverIds: number[]) =>
      api<any>(`/admin/providers/${id}/outlets`, { method: "POST", body: { serverIds } }),
  },
  // Operator-only: manage Asisten (limited per-outlet monitoring users).
  assistants: {
    list: () => api<Assistant[]>("/admin/assistants"),
    outlets: () => api<PlatformOutlet[]>("/admin/assistants/outlets"),
    get: (id: number) => api<Assistant>(`/admin/assistants/${id}`),
    create: (body: { name: string; username: string; password: string; canSell?: boolean; serverIds?: number[] }) =>
      api<any>("/admin/assistants", { method: "POST", body }),
    update: (
      id: number,
      body: Partial<{ name: string; password: string; status: "ACTIVE" | "SUSPENDED"; canSell: boolean }>,
    ) => api<any>(`/admin/assistants/${id}`, { method: "PATCH", body }),
    assignOutlets: (id: number, serverIds: number[]) =>
      api<any>(`/admin/assistants/${id}/outlets`, { method: "POST", body: { serverIds } }),
    remove: (id: number) => api<any>(`/admin/assistants/${id}`, { method: "DELETE" }),
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
