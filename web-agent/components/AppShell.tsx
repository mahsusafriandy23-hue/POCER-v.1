"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";
import { ALLOWED_ROLES } from "@/lib/config";
import { initial } from "@/lib/format";
import {
  GridIcon,
  WalletIcon,
  UserIcon,
  BoltIcon,
  ReceiptIcon,
  LogoutIcon,
  // BoltIcon retained for potential use
  UsersIcon,
} from "./icons";

type NavItem = { href: string; label: string; icon: (p: any) => ReactNode };

// Agen surface only — no owner navigation in this app.
const AGENT_NAV: NavItem[] = [
  { href: "/agen", label: "Beranda", icon: GridIcon },
  { href: "/agen/riwayat", label: "Transaksi", icon: ReceiptIcon },
  { href: "/agen/kontak", label: "Kontak", icon: UsersIcon },
  { href: "/agen/saldo", label: "Saldo", icon: WalletIcon },
  { href: "/agen/akun", label: "Akun", icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/agen") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Authenticated native phone shell: top bar + sticky bottom-nav. Guards the role. */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { ready, session, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    // This deployment doesn't expose this role's surface → bounce to login.
    if (!ALLOWED_ROLES.includes(role)) {
      router.replace("/masuk");
      return;
    }
    if (!session) router.replace("/masuk");
    else if (!ALLOWED_ROLES.includes(session.role)) {
      // Stale session for a role this deployment doesn't serve → drop it.
      logout();
      router.replace("/masuk");
    } else if (session.role !== role) {
      router.replace("/agen");
    }
  }, [ready, session, role, router, logout]);

  if (!ready || !session || session.role !== role || !ALLOWED_ROLES.includes(role)) {
    return (
      <div className="h-dvh grid place-items-center" style={{ background: "#0A0A0F" }}>
        <div className="h-8 w-8 rounded-full border-2 border-azure border-t-transparent animate-spin" />
      </div>
    );
  }

  const nav = AGENT_NAV;

  // Native phone-app shell: top bar + scrolling content + sticky bottom nav,
  // at every breakpoint (the phone-width column lives in the root layout).
  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: "#0A0A0F" }}>
      {/* Top bar — bright azure (matches the consumer "my mascaFi" identity) */}
      <header className="sticky top-0 z-20 bg-[#111118] border-b border-line px-4 h-14 flex items-center justify-between relative overflow-hidden">
        <div className="hero-glow absolute inset-0" aria-hidden />
        <div className="relative flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-azure/20 grid place-items-center font-extrabold text-azure">P</div>
          <div>
            <span className="font-extrabold tracking-tight text-ink">POCER</span>
            <span className="text-[10px] text-muted font-medium ml-1.5">by penanggak.net</span>
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-azure/20 grid place-items-center text-[13px] font-bold text-azure">
            {initial(session.name)}
          </div>
          <button
            onClick={logout}
            aria-label="Keluar"
            className="h-8 w-8 rounded-full grid place-items-center text-muted hover:bg-haze hover:text-ink transition-colors"
          >
            <LogoutIcon size={18} />
          </button>
        </div>
      </header>

      {/* Content — scrollable per-page, beranda pakai h-full flex-col */}
      <main className="flex-1 overflow-y-auto overscroll-none px-4 pt-4 pb-4 w-full">{children}</main>

      {/* Sticky bottom nav (native pattern) */}
      <nav className="sticky bottom-0 z-30 bg-[#111118]/95 backdrop-blur border-t border-line px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-5">
          {nav.map((it) => {
            const active = isActive(pathname, it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-1 py-1 rounded-xl text-[11px] tracking-tight transition-colors ${
                  active ? "font-bold text-azure" : "font-medium text-dim"
                }`}
              >
                <Icon size={22} />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Page heading used at the top of console pages. */
export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-[22px] font-extrabold text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
