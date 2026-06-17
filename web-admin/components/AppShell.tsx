"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { owner, type Role } from "@/lib/api";
import { ALLOWED_ROLES } from "@/lib/config";
import { initial } from "@/lib/format";
import {
  GridIcon,
  UsersIcon,
  TagIcon,
  WalletIcon,
  UserIcon,
  StoreIcon,
  BoltIcon,
  BoxIcon,
  ReceiptIcon,
  ChartIcon,
  SettingsIcon,
  LogoutIcon,
} from "./icons";

type NavItem = { href: string; label: string; icon: (p: any) => ReactNode; mobile?: boolean };

// Operator-only destinations (manage brands + assistants). Injected when me.isOperator.
const OPERATOR_NAV: NavItem[] = [
  { href: "/owner/brand", label: "Brand", icon: BoxIcon },
  { href: "/owner/asisten", label: "Asisten", icon: UsersIcon },
];

const OWNER_NAV: NavItem[] = [
  { href: "/owner", label: "Dashboard", icon: GridIcon, mobile: true },
  { href: "/owner/transaksi", label: "Transaksi", icon: ReceiptIcon, mobile: true },
  { href: "/owner/agen", label: "Agen", icon: UsersIcon, mobile: true },
  { href: "/owner/paket", label: "Paket", icon: TagIcon, mobile: true },
  { href: "/owner/laporan", label: "Laporan", icon: ChartIcon },
  { href: "/owner/outlet", label: "Outlet", icon: StoreIcon },
  { href: "/owner/pelanggan", label: "Pelanggan", icon: WalletIcon, mobile: true },
  { href: "/owner/pengaturan", label: "Pengaturan", icon: SettingsIcon },
  { href: "/owner/akun", label: "Akun", icon: UserIcon, mobile: true },
];

const AGENT_NAV: NavItem[] = [
  { href: "/agen", label: "Beranda", icon: GridIcon, mobile: true },
  { href: "/agen/jual", label: "Jual", icon: BoltIcon, mobile: true },
  { href: "/agen/saldo", label: "Saldo", icon: WalletIcon, mobile: true },
  { href: "/agen/riwayat", label: "Riwayat", icon: ReceiptIcon, mobile: true },
  { href: "/agen/akun", label: "Akun", icon: UserIcon, mobile: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/owner" || href === "/agen") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Authenticated shell: desktop sidebar + mobile bottom-nav. Guards the role. */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { ready, session, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOperator, setIsOperator] = useState(false);

  // Discover operator capability to reveal the Penyedia Layanan menu.
  useEffect(() => {
    if (!ready || !session || session.role !== "owner") return;
    let alive = true;
    owner
      .me()
      .then((m) => alive && setIsOperator(!!m.isOperator))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, session]);

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
      router.replace(session.role === "owner" ? "/owner" : "/agen");
    }
  }, [ready, session, role, router, logout]);

  if (!ready || !session || session.role !== role || !ALLOWED_ROLES.includes(role)) {
    return (
      <div className="min-h-screen grid place-items-center bg-stage">
        <div className="h-8 w-8 rounded-full border-2 border-azure border-t-transparent animate-spin" />
      </div>
    );
  }

  let nav = role === "owner" ? OWNER_NAV : AGENT_NAV;
  if (role === "owner" && isOperator) {
    // Insert operator destinations right after Dashboard.
    nav = [nav[0], ...OPERATOR_NAV, ...nav.slice(1)];
  }
  const roleLabel = role === "owner" ? "Pemilik" : "Agen";

  return (
    <div className="min-h-screen bg-stage md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 bg-ink text-white/90 px-4 py-6 md:min-h-screen md:sticky md:top-0">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="h-9 w-9 rounded-xl bg-hero grid place-items-center font-extrabold text-white">P</div>
          <div>
            <div className="font-extrabold text-white leading-tight">POCER</div>
            <div className="text-[11px] text-white/50 -mt-0.5">Admin · {roleLabel}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((it) => {
            const active = isActive(pathname, it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={20} />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold text-white/60 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogoutIcon size={20} /> Keluar
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 bg-ink text-white px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-hero grid place-items-center font-extrabold">P</div>
            <span className="font-extrabold">POCER</span>
            <span className="text-[11px] bg-white/15 rounded-full px-2 py-0.5">{roleLabel}</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-white/15 grid place-items-center text-[13px] font-bold">
            {initial(session.name)}
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-5 md:py-8 pb-24 md:pb-8 w-full max-w-5xl mx-auto">{children}</main>
      </div>

      {/* Mobile bottom nav — only the primary (mobile-flagged) destinations */}
      {(() => {
        const mobileNav = nav.filter((n) => n.mobile);
        return (
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        <div className="grid max-w-md mx-auto" style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}>
          {mobileNav.map((it) => {
            const active = isActive(pathname, it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold ${
                  active ? "text-azure" : "text-dim"
                }`}
              >
                <Icon size={22} />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
        );
      })()}
    </div>
  );
}

/** Page heading used at the top of console pages. */
export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-[22px] md:text-[26px] font-extrabold text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
