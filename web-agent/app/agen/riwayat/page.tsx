"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { agent, type Ledger, ApiError } from "@/lib/api";
import { rupiah, formatExpiry } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, EmptyState, Skeleton } from "@/components/kit";
import { Alert } from "@/components/ui";
import { ReceiptIcon, CopyIcon, CheckIcon } from "@/components/icons";

type Period = "today" | "week" | "month" | "";

function periodLabel(p: Period) {
  if (p === "today") return "Hari ini";
  if (p === "week")  return "Minggu ini";
  if (p === "month") return "Bulan ini";
  return "Semua";
}

function filterByPeriod(rows: Ledger[], period: Period): Ledger[] {
  if (!period) return rows;
  const now = new Date();
  const start = new Date();
  if (period === "today") { start.setHours(0, 0, 0, 0); }
  else if (period === "week") { start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); }
  else if (period === "month") { start.setDate(1); start.setHours(0, 0, 0, 0); }
  return rows.filter((r) => new Date(r.createdAt) >= start);
}

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Isi saldo",
  PURCHASE: "Penjualan voucher",
  REFUND: "Pengembalian",
  ADJUSTMENT: "Penyesuaian",
};

const PERIODS: { key: Period; label: string }[] = [
  { key: "",       label: "Semua"   },
  { key: "today",  label: "Hari ini" },
  { key: "week",   label: "Minggu"   },
  { key: "month",  label: "Bulan"    },
];

export default function AgentHistory() {
  const sp = useSearchParams();
  const [rows, setRows] = useState<Ledger[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>((sp.get("period") as Period) || "");

  useEffect(() => {
    const p = sp.get("period") as Period;
    if (p) setPeriod(p);
  }, [sp]);

  function copyCode(id: number, code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    });
  }

  useEffect(() => {
    (async () => {
      try {
        setRows(await agent.transactions(100));
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Gagal memuat riwayat.");
      }
    })();
  }, []);

  const filtered = rows ? filterByPeriod(rows, period) : null;

  return (
    <div>
      <PageTitle title="Riwayat" subtitle="Mutasi saldo dompet Anda." />

      {/* Period filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold border transition-colors ${
              period === p.key ? "bg-azure text-[#0A0A0F] border-azure" : "bg-surface text-muted border-line"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {err && <Alert tone="error">{err}</Alert>}

      {!filtered ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<ReceiptIcon size={24} />} title="Belum ada transaksi" hint={`Tidak ada mutasi untuk ${periodLabel(period).toLowerCase()}.`} />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {filtered.map((t) => {
            const credit = t.direction === "CREDIT";
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className={`h-10 w-10 rounded-xl grid place-items-center font-extrabold text-[18px] ${
                    credit ? "bg-emerald-900/40 text-emerald-400" : "bg-rose-900/40 text-rose-400"
                  }`}
                >
                  {credit ? "+" : "−"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink text-[14px] truncate">{TYPE_LABEL[t.type] ?? t.type}</div>
                  <div className="text-[12px] text-muted truncate">
                    {t.description || formatExpiry(t.createdAt)}
                  </div>
                  {t.voucherCode && (
                    <button
                      type="button"
                      onClick={() => copyCode(t.id, t.voucherCode!)}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-azure/15 border border-azure/25 px-2 py-1 font-mono text-[12px] font-bold text-azure active:scale-95 transition"
                      title="Ketuk untuk menyalin kode"
                    >
                      {t.voucherCode}
                      {copiedId === t.id ? (
                        <CheckIcon size={13} className="text-emerald-600" />
                      ) : (
                        <CopyIcon size={13} className="opacity-50" />
                      )}
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-extrabold text-[14px] ${credit ? "text-emerald-600" : "text-ink"}`}>
                    {credit ? "+" : "−"}Rp{rupiah(t.amount)}
                  </div>
                  <div className="text-[11px] text-muted">Rp{rupiah(t.balanceAfter)}</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
