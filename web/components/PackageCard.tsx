"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useMotionTemplate,
} from "framer-motion";
import type { Pkg } from "@/lib/api";
import { rupiah } from "@/lib/format";

// ─── Barcode ───────────────────────────────────────────────────────────────

function Barcode() {
  const bars = [1,2,1,1,2,1,2,1,1,2,1,1,2,1,2,1,1,2,1,2,1,1,2,1,1,2,1,2,1,1,2,1,2,1,1,2,1,1,2,1,2,1,1,2,1,2,1,1,2,1];
  let x = 0;
  const rects = bars.map((w) => { const r = { x, w }; x += w + 1; return r; });
  const totalW = x - 1;
  return (
    <svg width={totalW} height={40} viewBox={`0 0 ${totalW} 40`}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={40} rx={0.3} fill="#9AA8C2" />
      ))}
    </svg>
  );
}

// ─── Duration code helper ──────────────────────────────────────────────────

function toDurationCode(raw: string): string {
  const m = raw.match(/^(\d+)\s*([a-zA-Z]+)/);
  if (!m) return raw.toUpperCase().slice(0, 4);
  const n = m[1];
  const u = m[2].toLowerCase();
  const unitMap: Record<string, string> = {
    h: "H", hr: "H", jam: "H", j: "H",
    d: "D", day: "D", hari: "D",
    m: "M", min: "M", menit: "M",
    w: "W", minggu: "W",
    mo: "MO", bulan: "MO",
  };
  return `${n}${unitMap[u] ?? u.toUpperCase().slice(0, 2)}`;
}

// ─── Main card ─────────────────────────────────────────────────────────────

export default function PackageCard({ pkg, onBuy }: { pkg: Pkg; onBuy: (p: Pkg) => void }) {
  const hasDiscount = !!pkg.originalPrice && pkg.originalPrice > pkg.price;
  const discountPct = hasDiscount
    ? Math.round((1 - pkg.price / (pkg.originalPrice as number)) * 100)
    : 0;
  const flash = !!pkg.isFlashSale;

  const serverCode = (pkg.server?.code ?? pkg.server?.name ?? "---").slice(0, 3).toUpperCase();
  const serverName = pkg.server?.name ?? "Outlet";

  // Parse speed dari bonusLabel: "Up to 5 Mbps" → { value: "5", unit: "Mbps" }
  const speedMatch = pkg.bonusLabel?.match(/(\d+(?:\.\d+)?)\s*(Mbps|Kbps|Gbps)/i);
  const speedValue = speedMatch?.[1] ?? null;
  const speedUnit = speedMatch?.[2] ?? null;

  // 3D tilt
  const cardRef = useRef<HTMLButtonElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [6, -6]), { stiffness: 400, damping: 28 });
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-6, 6]), { stiffness: 400, damping: 28 });
  const glareX = useTransform(rawX, [-0.5, 0.5], ["20%", "80%"]);
  const glareY = useTransform(rawY, [-0.5, 0.5], ["20%", "80%"]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.15) 0%, transparent 65%)`;

  function onMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function onMouseLeave() { rawX.set(0); rawY.set(0); }

  return (
    <div style={{ perspective: "1200px" }}>
      <motion.button
        ref={cardRef}
        onClick={() => onBuy(pkg)}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        whileTap={{ scale: 0.97 }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="w-full text-left rounded-2xl overflow-hidden bg-white ring-1 ring-line shadow-[0_4px_24px_-6px_rgba(30,107,255,.18)] hover:shadow-[0_12px_40px_-8px_rgba(30,107,255,.30)] transition-shadow duration-300 relative"
      >
        {/* Glare */}
        <motion.div className="absolute inset-0 rounded-2xl pointer-events-none z-20" style={{ background: glare }} />

        <div className="relative z-10">

          {/* ── Header ── */}
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-line/60">
            <span className="font-extrabold text-ink text-[11px] tracking-[0.12em] uppercase">POCER</span>
            <span className="font-mono text-azure text-[11px] font-bold tracking-wider">
              #{serverCode}{String(pkg.id).padStart(4, "0")}
            </span>
          </div>

          {/* ── Top half ── */}
          <div className="px-4 pt-3.5 pb-4">

            {/* Route row — gap simetris, width natural */}
            <div className="mt-1 flex items-center gap-3">

              {/* Kiri: kode outlet — spacer invisible agar height = kanan */}
              <div className="shrink-0">
                <p className="font-extrabold text-ink text-[38px] leading-none tracking-tighter">
                  {serverCode}
                </p>
                {/* Invisible spacer — match tinggi unit text di kanan */}
                <p className="text-[11px] mt-0.5 invisible select-none">mbps</p>
              </div>

              {/* Tengah: garis putus-putus */}
              <div className="flex-1 flex items-center px-1">
                <div className="w-full border-t-2 border-dashed border-azure/30" />
              </div>

              {/* Kanan: speed */}
              <div className="shrink-0 text-right">
                {speedValue ? (
                  <>
                    <p className="font-extrabold text-ink text-[38px] leading-none tracking-tighter">
                      {speedValue}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">{speedUnit}</p>
                  </>
                ) : (
                  <>
                    <p className="font-extrabold text-ink text-[38px] leading-none tracking-tighter">
                      {toDurationCode(pkg.duration)}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">{pkg.dataLimit ?? "Sekali pakai"}</p>
                  </>
                )}
              </div>
            </div>

            {/* 3-kolom info — kiri / tengah / kanan */}
            <div className="mt-4 grid grid-cols-3">
              <div className="text-left">
                <p className="text-[8px] font-bold text-muted uppercase tracking-widest">Paket</p>
                <p className="text-[13px] font-extrabold text-ink mt-0.5 truncate">{pkg.name}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-muted uppercase tracking-widest">Durasi</p>
                <p className="text-[13px] font-extrabold text-ink mt-0.5">{pkg.duration}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-bold text-muted uppercase tracking-widest">Kuota</p>
                <p className="text-[13px] font-extrabold text-azure mt-0.5">
                  {pkg.dataLimit || "Unlimited"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Tear line ── */}
          <div className="relative h-[18px] flex items-center">
            <div className="absolute -left-[9px] w-[18px] h-[18px] rounded-full bg-haze ring-1 ring-line z-10" />
            <div className="flex-1 border-t-2 border-dashed border-line mx-1" />
            <div className="absolute -right-[9px] w-[18px] h-[18px] rounded-full bg-haze ring-1 ring-line z-10" />
          </div>

          {/* ── Bottom half ── */}
          <div className="px-4 pt-2.5 pb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[8.5px] font-bold text-muted uppercase tracking-[0.18em]">Harga</p>
              <p className="font-extrabold text-azure leading-none tabular-nums tracking-tight mt-1">
                <span className="text-[14px] align-top mt-[3px] inline-block font-bold">Rp</span>
                <span className="text-[28px]">{rupiah(pkg.price)}</span>
              </p>
              {hasDiscount && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-azure text-[11px] font-extrabold">Hemat {discountPct}%</span>
                  <span className="text-[11px] text-dim line-through tabular-nums">
                    Rp{rupiah(pkg.originalPrice as number)}
                  </span>
                </div>
              )}
            </div>
            <div className="shrink-0">
              <Barcode />
            </div>
          </div>

        </div>
      </motion.button>
    </div>
  );
}
