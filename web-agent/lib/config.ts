import type { Role } from "./api";

/**
 * POCER Agen — this deployment is the AGENT surface only.
 *
 * Unlike the combined console, this app never exposes the owner login. The mode
 * is hard-locked to "agent": even if NEXT_PUBLIC_APP_MODE is set to something
 * else, we never fall back to "owner" or "both".
 */
export type AppMode = "agent" | "owner" | "both";

// Agent-only surface — always "agent", no fallback to owner/both.
export const APP_MODE: AppMode = "agent";

/** Roles this deployment allows to log in. */
export const ALLOWED_ROLES: Role[] = ["agent"];

/** The single role for this locked deployment. */
export const FIXED_ROLE: Role | null = "agent";
