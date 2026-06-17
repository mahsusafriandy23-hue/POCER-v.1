"use client";

import { useEffect, useState } from "react";
import { owner, type OwnerProfile, type OwnerOutlet, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, Skeleton } from "@/components/kit";
import { Button } from "@/components/ui";
import { StoreIcon, UsersIcon, LogoutIcon } from "@/components/icons";

export default function OwnerAccount() {
  const { session, logout } = useAuth();
  const [me, setMe] = useState<OwnerProfile | null>(null);
  const [outlets, setOutlets] = useState<OwnerOutlet[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [m, o] = await Promise.all([owner.me(), owner.outlets()]);
        setMe(m);
        setOutlets(o);
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
      }
    })();
  }, []);

  return (
    <div>
      <PageTitle title="Akun" subtitle="Profil pemilik & ringkasan." />

      <Card className="p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-hero text-white grid place-items-center text-xl font-extrabold">
          {(session?.name ?? "P").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-ink text-[17px] truncate">{session?.name}</div>
          <div className="text-[13px] text-muted truncate">
            {me?.username ? `@${me.username}` : ""} {me?.phone ? `· ${me.phone}` : ""}
          </div>
          <div className="mt-1.5">
            <Badge tone="azure">Pemilik</Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-haze text-azure grid place-items-center">
            <StoreIcon size={20} />
          </div>
          <div>
            <div className="text-[12px] text-muted font-semibold">Outlet</div>
            <div className="text-[18px] font-extrabold text-ink">{me ? me.outletCount : <Skeleton className="h-5 w-8" />}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-haze text-azure grid place-items-center">
            <UsersIcon size={20} />
          </div>
          <div>
            <div className="text-[12px] text-muted font-semibold">Agen</div>
            <div className="text-[18px] font-extrabold text-ink">{me ? me.agentCount : <Skeleton className="h-5 w-8" />}</div>
          </div>
        </Card>
      </div>

      <h2 className="text-[15px] font-extrabold text-ink mt-6 mb-3">Outlet yang dikelola</h2>
      <div className="space-y-2">
        {outlets.map((o) => (
          <Card key={o.id} className="p-3.5 flex items-center justify-between">
            <span className="font-bold text-ink">{o.name}</span>
            <span className="text-[12px] text-muted">{o.code}</span>
          </Card>
        ))}
        {outlets.length === 0 && <p className="text-[13px] text-muted">Belum ada outlet.</p>}
      </div>

      <Button variant="soft" fullWidth onClick={logout} className="mt-7 !text-rose-600 !bg-rose-50">
        <LogoutIcon size={18} /> Keluar
      </Button>

      <p className="text-center text-[12px] text-muted mt-4">mascaFi Console · Pemilik</p>
    </div>
  );
}
