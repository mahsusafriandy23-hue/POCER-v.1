"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { customer } from "@/lib/api";
import { rupiah, formatDate } from "@/lib/format";
import { SpinnerIcon } from "@/components/icons";

type Txn = {
  id: number;
  type?: string;
  amount: number;
  direction?: string;
  balanceAfter?: number;
  description?: string | null;
  createdAt?: string;
};

function Inner() {
  const [rows, setRows] = useState<Txn[] | null>(null);

  useEffect(() => {
    customer
      .transactions()
      .then((r) => setRows(r as Txn[]))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader title="Riwayat" subtitle="Mutasi saldo & transaksi" />

      <div className="flex-1 px-5 py-5 space-y-2.5">
        {rows === null ? (
          <div className="py-12 grid place-items-center text-azure">
            <SpinnerIcon size={28} />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-[13px] text-muted shadow-soft">
            Belum ada transaksi.
          </div>
        ) : (
          rows.map((t) => {
            const credit = (t.direction ?? (t.amount >= 0 ? "CREDIT" : "DEBIT")).toUpperCase() === "CREDIT";
            const amt = Math.abs(t.amount);
            return (
              <div key={t.id} className="rounded-2xl bg-white p-4 flex items-center justify-between shadow-soft">
                <div className="min-w-0">
                  <div className="font-semibold text-ink text-[14px] truncate">
                    {t.description || t.type || "Transaksi"}
                  </div>
                  <div className="text-[12px] text-muted">{formatDate(t.createdAt)}</div>
                </div>
                <div className={`font-extrabold shrink-0 ml-3 ${credit ? "text-emerald-600" : "text-ink"}`}>
                  {credit ? "+" : "−"}Rp{rupiah(amt)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default function RiwayatPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
