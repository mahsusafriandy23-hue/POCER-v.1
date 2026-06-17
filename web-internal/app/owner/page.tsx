"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { owner, type Reports, type OwnerProfile, type OwnerOutlet, ApiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { PageTitle } from "@/components/AppShell";
import { Card, StatCard, Money, EmptyState, SectionTitle, Skeleton, Badge } from "@/components/kit";
import { Alert } from "@/components/ui";
import { ChartIcon, ReceiptIcon, StoreIcon, UsersIcon, ChevronRightIcon } from "@/components/icons";

export default function OwnerDashboard() {
  const { session } = useAuth();
  const [me, setMe] = useState<OwnerProfile | null>(null);
  const [reports, setReports] = useState<Reports | null>(null);
  const [outlets, setOutlets] = useState<OwnerOutlet[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, r, o] = await Promise.all([owner.me(), owner.reports(), owner.outlets()]);
        if (!alive) return;
        setMe(m);
        setReports(r);
        setOutlets(o);
      } catch (e) {
        if (alive) setErr(e instanceof ApiError ? e.message : "Gagal memuat data.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <PageTitle title={`Halo, ${session?.name ?? "Pemilik"}`} subtitle="Ringkasan bisnis voucher Anda hari ini." />

      {err && <Alert tone="error">{err}</Alert>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {reports ? (
          <>
            <StatCard
              label="Total penjualan"
              value={<Money value={reports.totals.revenue} />}
              icon={<ChartIcon size={22} />}
              tone="azure"
            />
            <StatCard
              label="Transaksi"
              value={reports.totals.orders}
              icon={<ReceiptIcon size={22} />}
              tone="emerald"
            />
            <StatCard label="Outlet" value={me?.outletCount ?? "—"} icon={<StoreIcon size={22} />} tone="amber" />
            <StatCard label="Agen" value={me?.agentCount ?? "—"} icon={<UsersIcon size={22} />} tone="azure" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)
        )}
      </div>

      {/* Sales by outlet */}
      <div className="mt-7">
        <SectionTitle>Penjualan per outlet</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          {!reports ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : reports.byOutlet.length === 0 ? (
            <EmptyState icon={<StoreIcon size={24} />} title="Belum ada penjualan" hint="Penjualan akan muncul di sini." />
          ) : (
            reports.byOutlet.map((row) => (
              <div key={row.server.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <div className="font-bold text-ink">{row.server.name}</div>
                  <div className="text-[12px] text-muted">{row.orders} transaksi</div>
                </div>
                <div className="font-extrabold text-ink">
                  <Money value={row.revenue} />
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Top agents */}
      <div className="mt-7">
        <SectionTitle action={<Link href="/owner/agen" className="text-[13px] font-bold text-azure">Kelola</Link>}>
          Agen teratas
        </SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          {!reports ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : reports.byAgent.length === 0 ? (
            <EmptyState icon={<UsersIcon size={24} />} title="Belum ada penjualan agen" />
          ) : (
            reports.byAgent.slice(0, 5).map((row) => (
              <div key={row.agent.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate">{row.agent.name}</div>
                  <div className="text-[12px] text-muted">{row.orders} transaksi</div>
                </div>
                <div className="font-extrabold text-ink shrink-0">
                  <Money value={row.revenue} />
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Outlets quick links */}
      <div className="mt-7">
        <SectionTitle action={<Link href="/owner/paket" className="text-[13px] font-bold text-azure">Atur harga</Link>}>
          Outlet Anda
        </SectionTitle>
        <div className="space-y-2.5">
          {outlets?.map((o) => (
            <Link key={o.id} href={`/owner/paket?server=${o.id}`}>
              <Card className="p-4 flex items-center gap-3 hover:border-azure/40 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-haze text-azure grid place-items-center">
                  <StoreIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink">{o.name}</div>
                  <div className="text-[12px] text-muted">
                    {o.packageCount} paket · {o.hasRouter ? "router tersambung" : "router belum diatur"}
                  </div>
                </div>
                {!o.isActive && <Badge tone="warn">nonaktif</Badge>}
                <ChevronRightIcon size={18} className="text-dim" />
              </Card>
            </Link>
          ))}
          {outlets && outlets.length === 0 && (
            <Card>
              <EmptyState
                icon={<StoreIcon size={24} />}
                title="Belum ada outlet"
                hint="Operator platform belum menetapkan outlet untuk Anda."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
