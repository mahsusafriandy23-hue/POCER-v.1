import type { Role } from "./api";

/**
 * mascaFi ADMIN app — owner-only by default. (The agent app is a separate
 * deployment; the client app is web/.) An env override is honored for flexibility
 * but it never silently falls back to a less-restrictive surface here.
 */
export type AppMode = "agent" | "owner" | "both";

const raw = (process.env.NEXT_PUBLIC_APP_MODE || "owner").toLowerCase();
export const APP_MODE: AppMode =
  raw === "agent" || raw === "both" ? (raw as AppMode) : "owner";

/** Roles this deployment allows to log in. */
export const ALLOWED_ROLES: Role[] =
  APP_MODE === "both" ? ["owner", "agent"] : [APP_MODE === "owner" ? "owner" : "agent"];

/** The single role for a locked deployment (null when "both"). */
export const FIXED_ROLE: Role | null = APP_MODE === "both" ? null : ALLOWED_ROLES[0];
