"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import VoucherCard from "@/components/VoucherCard";
import { customer, type VoucherInbox } from "@/lib/api";
import { SpinnerIcon } from "@/components/icons";

function Inner() {
  const [vouchers, setVouchers] = useState<VoucherInbox[] | null>(null);

  useEffect(() => {
    customer
      .vouchers()
      .then(setVouchers)
      .catch(() => setVouchers([]));
  }, []);

  // Usable vouchers: active flag + not expired. A not-yet-activated voucher
  // (validity starts at first login) is still usable, so keep it in the list.
  const active =
    vouchers?.filter((v) => {
      if (!v.isActive) return false;
      if (v.validityStatus) return v.validityStatus !== "EXPIRED";
      // Fallback for older payloads: null expiry = not activated = still usable.
      return !v.expiryDate || new Date(v.expiryDate).getTime() > Date.now();
    }) ?? null;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader title="Voucher Saya" subtitle="Voucher yang masih aktif" />

      <div className="flex-1 px-5 py-5 space-y-3">
        {active === null ? (
          <div className="py-12 grid place-items-center text-azure">
            <SpinnerIcon size={28} />
          </div>
        ) : active.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-[13px] text-muted shadow-soft">
            Belum ada voucher aktif. Beli voucher dari Beranda 🎟️
          </div>
        ) : (
          active.map((v) => <VoucherCard key={v.id} v={v} />)
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default function VoucherPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
