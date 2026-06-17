"use client";

import { useState } from "react";
import type { VoucherInbox } from "@/lib/api";
import { formatExpiry, humanDuration } from "@/lib/format";
import { CopyIcon, CheckIcon } from "./icons";

export default function VoucherCard({ v }: { v: VoucherInbox }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(v.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const dur = v.package ? humanDuration(v.package.duration) : "";
  const notActivated = v.validityStatus === "NOT_ACTIVATED" || (!v.activatedAt && !v.expiryDate);
  const badge = notActivated ? "Belum dipakai" : v.isActive ? "Aktif" : "Nonaktif";
  const validityText = notActivated ? null : `Berlaku s/d ${formatExpiry(v.expiryDate)}`;

  return (
    <div className="rounded-2xl p-4 text-white bg-inbox shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-white/70">
          {v.package?.name ?? "Voucher"}
          {dur && <span className="text-white/40"> · {dur}</span>}
        </span>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full ${
            notActivated ? "bg-amber-300/20 text-amber-100" : v.isActive ? "bg-white/15" : "bg-white/10 text-white/50"
          }`}
        >
          {badge}
        </span>
      </div>

      <button
        onClick={copy}
        className="mt-2 flex items-center gap-2 group"
        aria-label="Salin kode voucher"
      >
        <span className="font-mono text-2xl font-bold tracking-widest">{v.username}</span>
        <span className="text-white/60 group-hover:text-white transition-colors">
          {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
        </span>
      </button>

      {(copied || validityText) && (
        <div className="text-[12px] text-white/55 mt-1">
          {copied ? "Kode disalin ✓" : validityText}
        </div>
      )}
    </div>
  );
}
