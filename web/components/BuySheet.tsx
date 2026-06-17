"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import QrisPane from "./QrisPane";
import VoucherCard from "./VoucherCard";
import { Button, Alert } from "./ui";
import { customer, ApiError, type Pkg, type QrisResult, type VoucherInbox, type Wallet } from "@/lib/api";
import { rupiah, humanDuration } from "@/lib/format";
import { BoltIcon, TicketIcon, CheckIcon } from "./icons";

type Props = {
  pkg: Pkg | null;
  wallet: Wallet | null;
  open: boolean;
  onClose: () => void;
  /** Called after a successful purchase so the page can refresh wallet + inbox. */
  onDone: () => void;
};

type Stage =
  | { kind: "choose" }
  | { kind: "processing" }
  | { kind: "done-balance"; voucher: VoucherInbox | null }
  | { kind: "qris"; data: QrisResult }
  | { kind: "done-qris"; code?: string };

export default function BuySheet({ pkg, wallet, open, onClose, onDone }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "choose" });
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStage({ kind: "choose" });
    setError(null);
  }

  function handleClose() {
    // If a purchase completed, make sure the page refreshes.
    if (stage.kind === "done-balance" || stage.kind === "done-qris") onDone();
    reset();
    onClose();
  }

  async function payBalance() {
    if (!pkg) return;
    setError(null);
    setStage({ kind: "processing" });
    try {
      const res = await customer.purchase(pkg.id, "balance");
      setStage({ kind: "done-balance", voucher: res.voucher });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Pembelian gagal.");
      setStage({ kind: "choose" });
    }
  }

  async function payQris() {
    if (!pkg) return;
    setError(null);
    setStage({ kind: "processing" });
    try {
      const res = (await customer.purchase(pkg.id, "qris")) as QrisResult;
      setStage({ kind: "qris", data: res });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal membuat pembayaran.");
      setStage({ kind: "choose" });
    }
  }

  const available = wallet?.available ?? 0;
  const enough = pkg ? available >= pkg.price : false;

  return (
    <Sheet open={open} onClose={handleClose} title={stage.kind === "choose" ? "Beli Voucher" : undefined}>
      {!pkg ? null : stage.kind === "choose" ? (
        <div className="space-y-4">
          {/* package summary */}
          <div className="rounded-2xl bg-white p-4 shadow-soft flex items-center justify-between">
            <div>
              <div className="font-bold text-ink">
                {pkg.name} <span className="text-azure font-semibold">· {humanDuration(pkg.duration)}</span>
              </div>
              {pkg.server && (
                <div className="text-[12px] text-muted mt-0.5 uppercase">{pkg.server.name}</div>
              )}
            </div>
            <div className="text-xl font-extrabold text-ink">Rp{rupiah(pkg.price)}</div>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="space-y-2.5">
            <button
              onClick={payBalance}
              disabled={!enough}
              className="w-full rounded-2xl bg-white border border-line p-4 flex items-center gap-3 text-left enabled:hover:border-azure enabled:active:scale-[.99] transition-all disabled:opacity-60"
            >
              <span className="w-10 h-10 rounded-xl bg-haze text-azure grid place-items-center shrink-0">
                <BoltIcon size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-ink">Bayar pakai Saldo</span>
                <span className="block text-[12px] text-muted">
                  Saldo: Rp{rupiah(available)} {enough ? "· voucher langsung jadi" : "· saldo kurang"}
                </span>
              </span>
            </button>

            <button
              onClick={payQris}
              className="w-full rounded-2xl bg-white border border-line p-4 flex items-center gap-3 text-left hover:border-azure active:scale-[.99] transition-all"
            >
              <span className="w-10 h-10 rounded-xl bg-haze text-azure grid place-items-center shrink-0">
                <TicketIcon size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-ink">Bayar pakai QRIS</span>
                <span className="block text-[12px] text-muted">Scan QR, voucher masuk otomatis</span>
              </span>
            </button>
          </div>
        </div>
      ) : stage.kind === "processing" ? (
        <div className="py-12 grid place-items-center text-muted text-[14px] gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-haze border-t-azure animate-spin" />
          Memproses…
        </div>
      ) : stage.kind === "qris" ? (
        <div>
          <h2 className="text-lg font-extrabold text-ink mb-1 px-1">Bayar QRIS</h2>
          <p className="text-[13px] text-muted mb-4 px-1">{pkg.name} · {humanDuration(pkg.duration)}</p>
          <QrisPane
            reference={stage.data.reference}
            qrUrl={stage.data.payment.qrUrl}
            totalAmount={stage.data.payment.totalAmount}
            expiresAt={stage.data.payment.expiresAt}
            onPaid={(st) => setStage({ kind: "done-qris", code: st?.vouchers?.[0]?.username })}
          />
        </div>
      ) : stage.kind === "done-balance" ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center pt-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
              <CheckIcon size={28} strokeWidth={2.6} />
            </div>
            <p className="mt-3 font-extrabold text-ink text-lg">Voucher siap dipakai!</p>
            <p className="text-[13px] text-muted">Sudah masuk ke "Voucher Saya".</p>
          </div>
          {stage.voucher && <VoucherCard v={stage.voucher} />}
          <Button fullWidth onClick={handleClose}>
            Selesai
          </Button>
        </div>
      ) : (
        // done-qris
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center pt-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
              <CheckIcon size={28} strokeWidth={2.6} />
            </div>
            <p className="mt-3 font-extrabold text-ink text-lg">Pembayaran berhasil!</p>
            <p className="text-[13px] text-muted">
              {stage.code ? "Kode voucher kamu:" : "Voucher sedang dikirim ke akunmu."}
            </p>
            {stage.code && (
              <div className="mt-2 font-mono text-2xl font-bold tracking-widest text-ink">{stage.code}</div>
            )}
          </div>
          <Button fullWidth onClick={handleClose}>
            Lihat Voucher Saya
          </Button>
        </div>
      )}
    </Sheet>
  );
}
