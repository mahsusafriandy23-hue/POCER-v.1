"use client";

import { useEffect, useState } from "react";
import type { VoucherInbox } from "@/lib/api";
import { remaining, elapsedFraction, formatExpiry, humanDuration } from "@/lib/format";
import { ClockIcon, CopyIcon, CheckIcon } from "./icons";

/**
 * Highlights the voucher currently in use with a live remaining-time countdown
 * and a progress bar — like a mobile operator's "active package" card.
 */
export default function ActiveVoucherCard({ v }: { v: VoucherInbox }) {
  const [, tick] = useState(0);
  const [copied, setCopied] = useState(false);

  // Re-render every second for the live countdown.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const rem = remaining(v.expiryDate);
  const frac = elapsedFraction(v.createdAt, v.expiryDate);
  const pct = Math.round((1 - frac) * 100); // time left, as %

  async function copy() {
    try {
      await navigator.clipboard.writeText(v.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-4xl bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-haze text-azure grid place-items-center shrink-0">
          <ClockIcon size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted font-medium">Voucher aktif</div>
          <div className="font-extrabold text-ink truncate">
            {v.package?.name ?? "Voucher"}
            {v.package?.duration && (
              <span className="text-azure font-semibold"> · {humanDuration(v.package.duration)}</span>
            )}
          </div>
        </div>
        <button
          onClick={copy}
          className="text-[12px] font-bold text-azure bg-haze px-2.5 py-1.5 rounded-lg flex items-center gap-1 shrink-0"
          aria-label="Salin kode voucher"
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          <span className="font-mono">{v.username}</span>
        </button>
      </div>

      {/* Remaining time */}
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-[11px] text-muted">Sisa waktu</div>
          <div className={`text-[26px] leading-none font-extrabold tracking-tight ${rem.expired ? "text-rose-500" : "text-ink"}`}>
            {rem.label}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted">Berlaku s/d</div>
          <div className="text-[13px] font-semibold text-ink">{formatExpiry(v.expiryDate)}</div>
        </div>
      </div>

      {/* Progress bar (time left) */}
      <div className="mt-3 h-2 rounded-full bg-haze overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            rem.expired ? "bg-rose-400" : pct < 20 ? "bg-amber-400" : "bg-azure"
          }`}
          style={{ width: `${rem.expired ? 0 : Math.max(3, pct)}%` }}
        />
      </div>
    </div>
  );
}
