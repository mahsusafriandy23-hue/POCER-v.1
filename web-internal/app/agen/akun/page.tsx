"use client";

import { useEffect, useState } from "react";
import { agent, type AgentProfile, ApiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, Skeleton } from "@/components/kit";
import { Button } from "@/components/ui";
import { StoreIcon, WalletIcon, LogoutIcon } from "@/components/icons";

export default function AgentAccount() {
  const { session, logout } = useAuth();
  const [me, setMe] = useState<AgentProfile | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setMe(await agent.me());
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
      }
    })();
  }, []);

  return (
    <div>
      <PageTitle title="Akun" subtitle="Profil agen." />

      <Card className="p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-hero text-white grid place-items-center text-xl font-extrabold">
          {(session?.name ?? "A").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-ink text-[17px] truncate">{session?.name}</div>
          <div className="text-[13px] text-muted truncate">
            {me?.username ? `@${me.username}` : ""} {me?.phone ? `· ${me.phone}` : ""}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge tone="azure">Agen</Badge>
            {me && (me.status === "ACTIVE" ? <Badge tone="success">aktif</Badge> : <Badge tone="danger">nonaktif</Badge>)}
          </div>
        </div>
      </Card>

      <Card className="p-5 mt-4 bg-inbox text-white border-0 relative overflow-hidden">
        <div className="absolute inset-0 hero-glow" />
        <div className="relative flex items-center gap-2 text-white/70 text-[13px] font-semibold">
          <WalletIcon size={18} /> Saldo dompet
        </div>
        <div className="relative text-[26px] font-extrabold mt-1">
          <span className="opacity-60 text-[16px]">Rp</span> {me ? rupiah(me.balance) : "…"}
        </div>
      </Card>

      <h2 className="text-[15px] font-extrabold text-ink mt-6 mb-3">Outlet yang boleh dijual</h2>
      {!me ? (
        <Skeleton className="h-12" />
      ) : me.outlets.length === 0 ? (
        <p className="text-[13px] text-muted">Belum ada outlet. Hubungi pemilik.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {me.outlets.map((o) => (
            <Badge key={o.id} tone="neutral">
              <StoreIcon size={14} /> {o.name}
            </Badge>
          ))}
        </div>
      )}

      {me?.owner && <p className="text-[12px] text-muted mt-6">Pemilik: {me.owner.name}</p>}

      <Button variant="soft" fullWidth onClick={logout} className="mt-6 !text-rose-600 !bg-rose-50">
        <LogoutIcon size={18} /> Keluar
      </Button>

      <p className="text-center text-[12px] text-muted mt-4">POCER Console · Agen</p>
    </div>
  );
}
