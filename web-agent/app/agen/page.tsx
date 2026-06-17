"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agent, type AgentProfile, type AgentStats, type ChartDay, ApiError } from "@/lib/api";
import { rupiah, greeting } from "@/lib/format";
import { Skeleton } from "@/components/kit";
import { Alert } from "@/components/ui";
import { BoltIcon, TagIcon } from "@/components/icons";

// ─── Area chart ────────────────────────────────────────────────────────────

function AreaChart({ data }: { data: ChartDay[] }) {
  const W = 310, H = 80, PX = 6, PY = 8, AXIS = 14;
  const cH = H - PY - AXIS;  // chart area height
  const cW = W - PX * 2;     // chart area width
  const today = new Date().getDate();
  const total = data.reduce((s, d) => s + d.revenue, 0);

  // Always show 31 days; fill future days with 0
  const full: { day: number; revenue: number }[] = Array.from({ length: 31 }, (_, i) => {
    const found = data.find((d) => d.day === i + 1);
    return { day: i + 1, revenue: found?.revenue ?? 0 };
  });

  const max = Math.max(...full.map((d) => d.revenue), 1);

  const xOf = (day: number) => PX + ((day - 1) / 30) * cW;
  // clamp Y so points never go above PY or below PY+cH
  const yOf = (rev: number) => Math.max(PY, Math.min(PY + cH, PY + cH - (rev / max) * cH));

  const pts = full.map((d) => ({ x: xOf(d.day), y: yOf(d.revenue), rev: d.revenue }));

  // Monotone-style smooth: reduce overshoot by limiting control point strength
  function curvePath(ps: { x: number; y: number }[]) {
    let d = `M${ps[0].x},${ps[0].y}`;
    for (let i = 1; i < ps.length; i++) {
      const prev = ps[i - 1], curr = ps[i];
      const tension = 0.35;
      const cpX = (prev.x + curr.x) / 2;
      const cp1y = prev.y + (curr.y - prev.y) * tension;
      const cp2y = curr.y - (curr.y - prev.y) * tension;
      d += ` C${cpX},${cp1y} ${cpX},${cp2y} ${curr.x},${curr.y}`;
    }
    return d;
  }

  const linePath = curvePath(pts);
  const areaPath = `${linePath} L${pts[pts.length-1].x},${PY+cH} L${pts[0].x},${PY+cH} Z`;

  // Today marker
  const todayX = xOf(today);
  const todayY = yOf(full[today - 1]?.revenue ?? 0);

  // X axis labels: 1, 7, 14, 21, 28, 31
  const axisLabels = [1, 7, 14, 21, 28, 31];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 80, display: "block", overflow: "hidden" }}
        preserveAspectRatio="none"
      >
        <defs>
          <clipPath id="chartClip">
            <rect x={PX - 1} y={PY - 2} width={cW + 2} height={cH + 4} />
          </clipPath>
          <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#D4AF37" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#D4AF37" stopOpacity="0.3" />
            <stop offset="50%"  stopColor="#D4AF37" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="1"   />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.33, 0.66, 1].map((f, i) => (
          <line key={i} x1={PX} x2={W - PX}
            y1={PY + cH * (1 - f)} y2={PY + cH * (1 - f)}
            stroke="#1E1E2A" strokeWidth="0.8" />
        ))}

        {/* All chart elements clipped */}
        <g clipPath="url(#chartClip)">
          {/* Today column highlight */}
          <rect x={todayX - 1} y={PY} width={2} height={cH}
            fill="#D4AF37" opacity="0.08" />
          {/* Area */}
          <path d={areaPath} fill="url(#aG)" />
          {/* Line */}
          <path d={linePath} fill="none" stroke="url(#lG)"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Today dot */}
          <circle cx={todayX} cy={todayY} r="3.5" fill="#D4AF37" opacity="0.20" />
          <circle cx={todayX} cy={todayY} r="2"   fill="#D4AF37" />
          <circle cx={todayX} cy={todayY} r="0.9" fill="#0A0A0F" />
        </g>

        {/* X axis */}
        {axisLabels.map((d) => (
          <text key={d} x={xOf(d)} y={H - 2} fontSize="5.5" textAnchor="middle"
            fill={d === today ? "#D4AF37" : "#55556A"}
            fontWeight={d === today ? "bold" : "normal"}>
            {d}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AgentHome() {
  const [me,    setMe]    = useState<AgentProfile | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [chart, setChart] = useState<ChartDay[] | null>(null);
  const [err,   setErr]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [profile, s, c] = await Promise.all([agent.me(), agent.stats(), agent.chart()]);
        setMe(profile);
        setStats(s);
        setChart(c);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Gagal memuat data.");
      }
    })();
  }, []);

  return (
    <div className="h-full flex flex-col justify-between gap-3">
      {/* Greeting */}
      <div>
        <h1 className="text-[20px] font-extrabold text-ink leading-tight">
          {greeting()}, {me ? me.name.toUpperCase() : "—"} 👋
        </h1>
        <p className="text-[12px] text-muted mt-0.5">Selamat datang di Portal Agen.</p>
      </div>

      {err && <Alert tone="error">{err}</Alert>}

      {/* Saldo card */}
      <div className="rounded-2xl bg-surface border border-line px-4 py-3.5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-muted uppercase tracking-widest">Saldo Wallet</p>
          <div className="mt-1.5">
            {me ? (
              <span className="text-azure text-[26px] font-extrabold tracking-tight leading-none">
                Rp {rupiah(me.balance)}
              </span>
            ) : (
              <Skeleton className="h-7 w-36 bg-haze" />
            )}
          </div>
        </div>
        <Link
          href="/agen/saldo"
          className="flex items-center gap-2 rounded-2xl border border-line bg-haze px-4 py-2.5 text-[13px] font-bold text-ink hover:border-azure/40 transition-colors shrink-0"
        >
          <span className="text-[16px] leading-none">⊕</span> Top Up
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            { label: "Hari Ini",   key: "today", period: "today" },
            { label: "Minggu Ini", key: "week",  period: "week"  },
            { label: "Bulan Ini",  key: "month", period: "month" },
          ] as const
        ).map(({ label, key, period }) => {
          const s = stats?.[key];
          return (
            <Link
              key={key}
              href={`/agen/riwayat?period=${period}`}
              className="rounded-2xl bg-surface border border-line p-3 flex flex-col gap-0.5 active:scale-[.97] transition-transform"
            >
              <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{label}</p>
              {s ? (
                <>
                  <p className="text-[24px] font-extrabold text-ink leading-none mt-0.5">{s.count}</p>
                  <p className="text-[10px] text-muted">Rp {rupiah(s.revenue)}</p>
                </>
              ) : (
                <>
                  <Skeleton className="h-6 w-8 bg-haze mt-1" />
                  <Skeleton className="h-2.5 w-14 bg-haze mt-1" />
                </>
              )}
              <p className="text-[10px] font-semibold text-azure mt-1">Lihat ▾</p>
            </Link>
          );
        })}
      </div>

      {/* Chart */}
      <div className="rounded-2xl bg-surface border border-line px-4 py-3 flex-1 min-h-0 flex flex-col justify-center">
        {chart ? (
          <AreaChart data={chart} />
        ) : (
          <Skeleton className="h-16 bg-haze rounded-xl" />
        )}
      </div>

      {/* Action buttons */}
      <Link
        href="/agen/jual"
        className="rounded-2xl bg-azure px-4 py-3.5 flex items-center justify-between active:scale-[.98] transition-transform"
      >
        <div>
          <p className="text-[16px] font-extrabold text-[#0A0A0F]">Jual Voucher</p>
          <p className="text-[12px] text-[#0A0A0F]/60 mt-0.5">Pilih paket dan kirim ke pelanggan</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-[#0A0A0F]/15 grid place-items-center">
          <BoltIcon size={20} className="text-[#0A0A0F]" />
        </div>
      </Link>

      <Link
        href="/agen/harga"
        className="rounded-2xl bg-surface border border-line px-4 py-3.5 flex items-center justify-between active:scale-[.98] transition-transform"
      >
        <div>
          <p className="text-[16px] font-extrabold text-ink">Atur Harga</p>
          <p className="text-[12px] text-muted mt-0.5">Tentukan harga jual & untung per paket</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-haze grid place-items-center">
          <TagIcon size={20} className="text-azure" />
        </div>
      </Link>
    </div>
  );
}
