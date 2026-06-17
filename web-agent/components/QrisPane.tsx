"use client";

import { useEffect, useRef, useState } from "react";
import { orders, demo, IS_DEMO } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { SpinnerIcon, CheckIcon } from "./icons";

type Props = {
  reference: string;
  qrUrl: string;
  totalAmount: number;
  expiresAt: string;
  onPaid: (status: any) => void;
};

function countdown(target: number): string {
  const ms = Math.max(0, target - Date.now());
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Shows the QRIS code, a live expiry countdown, and polls until paid. */
export default function QrisPane({ reference, qrUrl, totalAmount, expiresAt, onPaid }: Props) {
  const expiry = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => countdown(expiry));
  const [expired, setExpired] = useState(false);
  const [paid, setPaid] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const firedRef = useRef(false);

  async function simulatePay() {
    setSimBusy(true);
    try {
      await demo.pay(reference);
      // The status poller will pick up PAID within ~3s and fire onPaid.
    } catch {
      setSimBusy(false);
    }
  }

  // Live countdown.
  useEffect(() => {
    const t = setInterval(() => {
      const left = expiry - Date.now();
      setRemaining(countdown(expiry));
      if (left <= 0) {
        setExpired(true);
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [expiry]);

  // Poll order status until PAID (or expired).
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const st = await orders.status(reference);
        if (!alive) return;
        if (st?.status === "PAID" || st?.status === "COMPLETED") {
          if (!firedRef.current) {
            firedRef.current = true;
            setPaid(true);
            onPaid(st);
          }
          return;
        }
      } catch {
        // transient — keep polling
      }
    };
    const id = setInterval(poll, 3000);
    poll();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [reference, onPaid]);

  if (paid) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
          <CheckIcon size={32} strokeWidth={2.6} />
        </div>
        <p className="mt-4 font-bold text-ink">Pembayaran diterima!</p>
        <p className="text-[13px] text-muted mt-1">Sedang memproses…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-3xl bg-white p-4 shadow-soft">
        {/* qrUrl is a ready-to-render QR image URL from the API */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl} alt="Kode QRIS" width={240} height={240} className="w-60 h-60 object-contain" />
      </div>

      <div className="mt-4 text-[28px] font-extrabold text-ink tracking-tight">Rp{rupiah(totalAmount)}</div>
      <p className="text-[13px] text-muted">Scan dengan aplikasi e-wallet / m-banking apa pun</p>

      {expired ? (
        <div className="mt-4 text-[13px] font-semibold text-rose-600">Kode kedaluwarsa. Tutup dan ulangi.</div>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-[13px] font-medium text-muted">
          <SpinnerIcon size={16} className="text-azure" />
          Menunggu pembayaran · sisa <span className="font-bold text-ink tabular-nums">{remaining}</span>
        </div>
      )}

      {IS_DEMO && !expired && (
        <div className="mt-5 w-full rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center">
          <p className="text-[12px] text-amber-700 font-medium">
            Mode demo — QR ini bukan QRIS asli, jadi tidak bisa di-scan e-wallet. Tekan tombol di bawah
            untuk mensimulasikan pembayaran.
          </p>
          <button
            onClick={simulatePay}
            disabled={simBusy}
            className="mt-3 w-full rounded-2xl bg-amber-500 text-white font-bold py-3 flex items-center justify-center gap-2 active:scale-[.98] transition-transform disabled:opacity-60"
          >
            {simBusy ? <SpinnerIcon size={18} /> : <CheckIcon size={18} strokeWidth={2.6} />}
            {simBusy ? "Memproses…" : "Simulasikan Pembayaran (demo)"}
          </button>
        </div>
      )}
    </div>
  );
}
