import type { Role } from "./api";

/**
 * Which login surface this deployment exposes:
 *  - "agent" → only the Agen login (public surface, e.g. agen.pocer…)
 *  - "owner" → only the Pemilik login (protected surface, e.g. admin.pocer…)
 *  - "both"  → role toggle shown (handy for local dev / single deploy)
 *
 * Set NEXT_PUBLIC_APP_MODE at build/deploy time. Defaults to "both".
 */
export type AppMode = "agent" | "owner" | "both";

const raw = (process.env.NEXT_PUBLIC_APP_MODE || "both").toLowerCase();
export const APP_MODE: AppMode =
  raw === "agent" || raw === "owner" ? (raw as AppMode) : "both";

/** Roles this deployment allows to log in. */
export const ALLOWED_ROLES: Role[] =
  APP_MODE === "both" ? ["owner", "agent"] : [APP_MODE === "owner" ? "owner" : "agent"];

/** The single role for a locked deployment (null when "both"). */
export const FIXED_ROLE: Role | null = APP_MODE === "both" ? null : ALLOWED_ROLES[0];
