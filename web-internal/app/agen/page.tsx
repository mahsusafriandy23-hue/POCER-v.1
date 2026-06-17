"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agent, type AgentProfile, ApiError } from "@/lib/api";
import { rupiah, greeting } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, Skeleton, EmptyState } from "@/components/kit";
import { Alert } from "@/components/ui";
import { BoltIcon, WalletIcon, StoreIcon, ReceiptIcon, ChevronRightIcon } from "@/components/icons";

export default function AgentHome() {
  const [me, setMe] = useState<AgentProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setMe(await agent.me());
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Gagal memuat data.");
      }
    })();
  }, []);

  return (
    <div>
      <PageTitle title={`${greeting()}${me ? `, ${me.name}` : ""}`} subtitle="Jual voucher untuk pelanggan Anda." />

      {err && <Alert tone="error">{err}</Alert>}

      {/* Balance card */}
      <div className="rounded-3xl bg-inbox text-white p-5 shadow-soft relative overflow-hidden">
        <div className="absolute inset-0 hero-glow" />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/70 text-[13px] font-semibold">
            <WalletIcon size={18} /> Saldo dompet
          </div>
          <div className="text-[30px] font-extrabold mt-1 tracking-tight">
            {me ? (
              <>
                <span className="opacity-60 text-[18px] align-top">Rp</span> {rupiah(me.balance)}
              </>
            ) : (
              <Skeleton className="h-8 w-40 bg-white/20" />
            )}
          </div>
          <div className="mt-4 flex gap-2.5">
            <Link
              href="/agen/jual"
              className="flex-1 rounded-2xl bg-white text-ink font-bold py-3 text-center text-[14px] flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
            >
              <BoltIcon size={18} /> Jual voucher
            </Link>
            <Link
              href="/agen/saldo"
              className="flex-1 rounded-2xl bg-white/15 text-white font-bold py-3 text-center text-[14px] flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
            >
              <WalletIcon size={18} /> Isi saldo
            </Link>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Link href="/agen/riwayat">
          <Card className="p-4 flex items-center gap-3 hover:border-azure/40 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-haze text-azure grid place-items-center">
              <ReceiptIcon size={20} />
            </div>
            <span className="font-bold text-ink text-[14px]">Riwayat</span>
            <ChevronRightIcon size={18} className="text-dim ml-auto" />
          </Card>
        </Link>
        <Link href="/agen/akun">
          <Card className="p-4 flex items-center gap-3 hover:border-azure/40 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-haze text-azure grid place-items-center">
              <StoreIcon size={20} />
            </div>
            <span className="font-bold text-ink text-[14px]">Akun</span>
            <ChevronRightIcon size={18} className="text-dim ml-auto" />
          </Card>
        </Link>
      </div>

      {/* Outlets */}
      <h2 className="text-[15px] font-extrabold text-ink mt-7 mb-3">Outlet Anda</h2>
      {!me ? (
        <Skeleton className="h-16" />
      ) : me.outlets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StoreIcon size={24} />}
            title="Belum ada outlet"
            hint="Pemilik Anda belum menetapkan outlet. Hubungi pemilik."
          />
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {me.outlets.map((o) => (
            <Badge key={o.id} tone="azure">
              <StoreIcon size={14} /> {o.name}
            </Badge>
          ))}
        </div>
      )}

      {me?.owner && <p className="text-[12px] text-muted mt-6">Pemilik: {me.owner.name}</p>}
    </div>
  );
}
