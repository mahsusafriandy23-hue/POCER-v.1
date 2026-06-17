"use client";

import { useEffect, useMemo, useState } from "react";
import { owner, type Reports, ApiError } from "@/lib/api";
import { rupiah, formatDate } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, StatCard, Money, EmptyState, Skeleton, SectionTitle } from "@/components/kit";
import { Button, Alert } from "@/components/ui";
import { ChartIcon, ReceiptIcon, StoreIcon, UsersIcon } from "@/components/icons";

function isoDaysAgo(days: number): string {
  // Build YYYY-MM-DD using the local date math via Date (allowed in the browser).
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function OwnerReports() {
  const [from, setFrom] = useState(() => isoDaysAgo(29));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [data, setData] = useState<Reports | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      setData(await owner.reports(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    if (!data) return;
    const lines: string[] = [];
    lines.push("Laporan penjualan," + from + " s/d " + to);
    lines.push("");
    lines.push("Per hari");
    lines.push("Tanggal,Transaksi,Pendapatan");
    data.byDay.forEach((d) => lines.push(`${d.date},${d.orders},${d.revenue}`));
    lines.push("");
    lines.push("Per outlet");
    lines.push("Outlet,Transaksi,Pendapatan");
    data.byOutlet.forEach((o) => lines.push(`${o.server.name},${o.orders},${o.revenue}`));
    lines.push("");
    lines.push("Per agen");
    lines.push("Agen,Transaksi,Pendapatan");
    data.byAgent.forEach((a) => lines.push(`${a.agent.name},${a.orders},${a.revenue}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageTitle
        title="Laporan"
        subtitle="Penjualan voucher di semua outlet Anda."
        action={
          <Button variant="soft" onClick={exportCsv} className="!py-2.5 !px-4" disabled={!data}>
            Export CSV
          </Button>
        }
      />

      {err && <Alert tone="error">{err}</Alert>}

      {/* Date range */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[140px]">
            <span className="block text-[13px] font-semibold text-ink mb-1.5">Dari</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-2xl bg-white border border-line px-4 py-3 text-[15px] text-ink outline-none focus:border-azure"
            />
          </label>
          <label className="flex-1 min-w-[140px]">
            <span className="block text-[13px] font-semibold text-ink mb-1.5">Sampai</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-2xl bg-white border border-line px-4 py-3 text-[15px] text-ink outline-none focus:border-azure"
            />
          </label>
          <Button onClick={load} loading={loading} className="!py-3">
            Terapkan
          </Button>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        {data ? (
          <>
            <StatCard label="Total pendapatan" value={<Money value={data.totals.revenue} />} icon={<ChartIcon size={22} />} />
            <StatCard label="Transaksi" value={data.totals.orders} icon={<ReceiptIcon size={22} />} tone="emerald" />
          </>
        ) : (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)
        )}
      </div>

      {/* Trend chart */}
      <div className="mt-6">
        <SectionTitle>Tren harian</SectionTitle>
        <Card className="p-4">
          {!data ? (
            <Skeleton className="h-40" />
          ) : data.byDay.length === 0 ? (
            <EmptyState icon={<ChartIcon size={24} />} title="Belum ada data di rentang ini" />
          ) : (
            <BarChart series={data.byDay} />
          )}
        </Card>
      </div>

      {/* Tables */}
      <div className="mt-6 grid lg:grid-cols-2 gap-5 items-start">
        <div>
          <SectionTitle>Per outlet</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {!data ? (
              <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
            ) : data.byOutlet.length === 0 ? (
              <EmptyState icon={<StoreIcon size={24} />} title="—" />
            ) : (
              data.byOutlet.map((o) => (
                <Row key={o.server.id} title={o.server.name} sub={`${o.orders} transaksi`} value={o.revenue} />
              ))
            )}
          </Card>
        </div>
        <div>
          <SectionTitle>Per agen</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {!data ? (
              <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
            ) : data.byAgent.length === 0 ? (
              <EmptyState icon={<UsersIcon size={24} />} title="—" />
            ) : (
              data.byAgent.map((a) => (
                <Row key={a.agent.id} title={a.agent.name} sub={`${a.orders} transaksi`} value={a.revenue} />
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ title, sub, value }: { title: string; sub: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="min-w-0">
        <div className="font-bold text-ink truncate">{title}</div>
        <div className="text-[12px] text-muted">{sub}</div>
      </div>
      <div className="font-extrabold text-ink shrink-0">
        <Money value={value} />
      </div>
    </div>
  );
}

/** Lightweight dependency-free SVG bar chart of daily revenue. */
function BarChart({ series }: { series: { date: string; revenue: number; orders: number }[] }) {
  const max = useMemo(() => Math.max(1, ...series.map((s) => s.revenue)), [series]);
  const peak = series.length;
  return (
    <div>
      <div className="flex items-end gap-1.5 h-40">
        {series.map((s) => {
          const h = Math.max(4, Math.round((s.revenue / max) * 150));
          return (
            <div key={s.date} className="flex-1 min-w-0 group relative flex flex-col justify-end items-center">
              <div
                className="w-full rounded-t-md bg-azure/80 group-hover:bg-azure transition-colors"
                style={{ height: `${h}px` }}
                title={`${s.date}: Rp${rupiah(s.revenue)} (${s.orders} trx)`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted mt-2">
        <span>{series[0] ? formatDate(series[0].date) : ""}</span>
        {peak > 1 && <span>{formatDate(series[peak - 1].date)}</span>}
      </div>
      <p className="text-[12px] text-muted mt-1">Puncak harian: Rp{rupiah(max)}</p>
    </div>
  );
}
