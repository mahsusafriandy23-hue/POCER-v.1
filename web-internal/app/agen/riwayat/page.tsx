"use client";

import { useEffect, useState } from "react";
import { agent, type Ledger, ApiError } from "@/lib/api";
import { rupiah, formatExpiry } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, EmptyState, Skeleton } from "@/components/kit";
import { Alert } from "@/components/ui";
import { ReceiptIcon } from "@/components/icons";

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Isi saldo",
  PURCHASE: "Penjualan voucher",
  REFUND: "Pengembalian",
  ADJUSTMENT: "Penyesuaian",
};

export default function AgentHistory() {
  const [rows, setRows] = useState<Ledger[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setRows(await agent.transactions(100));
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Gagal memuat riwayat.");
      }
    })();
  }, []);

  return (
    <div>
      <PageTitle title="Riwayat" subtitle="Mutasi saldo dompet Anda." />

      {err && <Alert tone="error">{err}</Alert>}

      {!rows ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ReceiptIcon size={24} />} title="Belum ada transaksi" hint="Mutasi muncul setelah top-up atau penjualan." />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {rows.map((t) => {
            const credit = t.direction === "CREDIT";
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className={`h-10 w-10 rounded-xl grid place-items-center font-extrabold ${
                    credit ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {credit ? "+" : "−"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink text-[14px] truncate">{TYPE_LABEL[t.type] ?? t.type}</div>
                  <div className="text-[12px] text-muted truncate">
                    {t.description || formatExpiry(t.createdAt)}
                  </div>
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
