"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import RequireAuth from "@/components/RequireAuth";
import BottomNav from "@/components/BottomNav";
import BuySheet from "@/components/BuySheet";
import TopupSheet from "@/components/TopupSheet";
import OutletPicker from "@/components/OutletPicker";
import ActiveVoucherCard from "@/components/ActiveVoucherCard";
import PackageCard from "@/components/PackageCard";
import { useAuth } from "@/lib/auth";
import { catalog, customer, type Pkg, type ServerLocation, type VoucherInbox, type Wallet } from "@/lib/api";
import { useOutletSelection } from "@/lib/useOutletSelection";
import { greeting, initial, rupiah } from "@/lib/format";
import { BellIcon, BoltIcon, PlusIcon, TicketIcon, ChatIcon, MapPinIcon, SpinnerIcon } from "@/components/icons";

function BerandaInner() {
  const { user } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [servers, setServers] = useState<ServerLocation[]>([]);
  const { activeId: activeServer, selectManual, recommendation, acceptRecommendation, dismissRecommendation } =
    useOutletSelection(servers);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [vouchers, setVouchers] = useState<VoucherInbox[]>([]);

  const [buyPkg, setBuyPkg] = useState<Pkg | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);

  const packagesRef = useRef<HTMLDivElement>(null);

  const loadWallet = useCallback(async () => {
    try {
      setWallet(await customer.wallet());
    } catch {
      /* ignore — shows Rp0 */
    }
  }, []);

  const loadVouchers = useCallback(async () => {
    try {
      setVouchers(await customer.vouchers());
    } catch {
      /* ignore */
    }
  }, []);

  // Initial load: wallet, servers, vouchers.
  useEffect(() => {
    loadWallet();
    loadVouchers();
    // Provider-scoped outlets (only this customer's Penyedia Layanan).
    customer
      .outlets()
      .then((s) => setServers(s))
      .catch(() => {});
  }, [loadWallet, loadVouchers]);

  // Load packages when location changes.
  useEffect(() => {
    if (activeServer == null) return;
    setPkgLoading(true);
    catalog
      .packages(activeServer)
      .then(setPackages)
      .catch(() => setPackages([]))
      .finally(() => setPkgLoading(false));
  }, [activeServer]);

  // The voucher currently in use: active, not yet expired, soonest to expire.
  const activeVoucher = vouchers
    .filter((v) => v.isActive && v.expiryDate && new Date(v.expiryDate).getTime() > Date.now())
    .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())[0];

  const refreshAfterPurchase = useCallback(() => {
    loadWallet();
    loadVouchers();
  }, [loadWallet, loadVouchers]);

  function scrollToPackages() {
    packagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Header ── */}
      <header className="bg-hero relative px-5 pt-7 pb-20 text-white">
        <div className="hero-glow absolute inset-0" aria-hidden />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur grid place-items-center font-bold">
              {initial(user?.name, user?.phone)}
            </div>
            <div>
              <div className="text-[13px] text-white/80">{greeting()},</div>
              <div className="font-bold -mt-0.5">{user?.name?.split(" ")[0] || "Pelanggan"} 👋</div>
            </div>
          </div>
          <Link
            href="/akun"
            className="w-10 h-10 rounded-full bg-white/15 grid place-items-center hover:bg-white/25 transition-colors"
            aria-label="Notifikasi"
          >
            <BellIcon size={20} />
          </Link>
        </div>
      </header>

      {/* ── Balance card (overlaps hero) ── */}
      <div className="px-5 -mt-14 relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="rounded-4xl bg-white p-5 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted font-medium">Saldo POCER</span>
            {user && (
              <span className="text-[11px] font-semibold text-azure bg-haze px-2 py-1 rounded-full">
                {user.username ? `@${user.username}` : `Akun #${user.id}`}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-end gap-1">
            <span className="text-[15px] font-semibold text-ink mb-1">Rp</span>
            <span className="text-[34px] leading-none font-extrabold text-ink tracking-tight">
              {wallet ? rupiah(wallet.available) : "—"}
            </span>
          </div>
          {wallet && wallet.held > 0 && (
            <div className="text-[12px] text-muted mt-1">Tertahan Rp{rupiah(wallet.held)}</div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => setTopupOpen(true)}
              className="rounded-2xl bg-azure text-white font-bold py-3 shadow-qa flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
            >
              <PlusIcon size={18} strokeWidth={2.4} /> Isi Saldo
            </button>
            <button
              onClick={scrollToPackages}
              className="rounded-2xl bg-haze text-azure font-bold py-3 flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
            >
              <TicketIcon size={18} /> Beli Voucher
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── Active voucher (live remaining time) ── */}
      {activeVoucher && (
        <div className="px-5 mt-3">
          <ActiveVoucherCard v={activeVoucher} />
        </div>
      )}

      {/* ── Quick actions (horizontal cards; Isi Saldo lives on the balance card) ── */}
      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        {[
          { label: "Beli Cepat", sub: "Voucher kilat", Icon: BoltIcon, onClick: scrollToPackages },
          { label: "Bantuan", sub: "Tanya admin", Icon: ChatIcon, href: "/akun" },
        ].map(({ label, sub, Icon, href, onClick }) => {
          const inner = (
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-line active:scale-[.98] transition-transform">
              <span className="w-10 h-10 rounded-xl bg-haze text-azure grid place-items-center shrink-0">
                <Icon size={20} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-ink text-[13px] leading-tight">{label}</span>
                <span className="block text-[11px] text-muted truncate">{sub}</span>
              </span>
            </div>
          );
          return href ? (
            <Link key={label} href={href} className="block">
              {inner}
            </Link>
          ) : (
            <button key={label} onClick={onClick} className="block w-full text-left">
              {inner}
            </button>
          );
        })}
      </div>

      {/* ── Location (outlet) picker ── */}
      {servers.length > 0 && (
        <div className="px-5 mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-ink">Pilih outlet</span>
            <span className="text-[12px] text-muted">{packages.length} paket</span>
          </div>
          <OutletPicker servers={servers} activeId={activeServer} onChange={selectManual} />

          {/* Nearest-outlet recommendation (never auto-switches) */}
          {recommendation && (
            <div className="mt-2 rounded-2xl bg-haze border border-line p-3 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-white text-azure grid place-items-center shrink-0">
                <MapPinIcon size={18} />
              </span>
              <span className="flex-1 text-[12px] text-ink">
                Kamu lebih dekat ke{" "}
                <span className="font-bold uppercase">{recommendation.name}</span>. Ganti outlet?
              </span>
              <button
                onClick={acceptRecommendation}
                className="text-[12px] font-bold text-white bg-azure px-3 py-1.5 rounded-lg shrink-0"
              >
                Ganti
              </button>
              <button
                onClick={dismissRecommendation}
                className="text-[12px] font-semibold text-muted shrink-0"
                aria-label="Tutup saran"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Packages ── */}
      <div ref={packagesRef} className="px-5 mt-3 space-y-2.5 scroll-mt-4">
        {pkgLoading ? (
          <div className="py-8 grid place-items-center text-azure">
            <SpinnerIcon size={26} />
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-[13px] text-muted shadow-soft">
            Belum ada paket di lokasi ini.
          </div>
        ) : (
          packages.map((p) => <PackageCard key={p.id} pkg={p} onBuy={setBuyPkg} />)
        )}
      </div>

      <div className="flex-1 mt-6" />
      <BottomNav />

      {/* ── Sheets ── */}
      <BuySheet
        pkg={buyPkg}
        wallet={wallet}
        open={buyPkg !== null}
        onClose={() => setBuyPkg(null)}
        onDone={refreshAfterPurchase}
      />
      <TopupSheet open={topupOpen} onClose={() => setTopupOpen(false)} onDone={loadWallet} />
    </div>
  );
}

export default function BerandaPage() {
  return (
    <RequireAuth>
      <BerandaInner />
    </RequireAuth>
  );
}
