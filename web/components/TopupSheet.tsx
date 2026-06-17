"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import QrisPane from "./QrisPane";
import { Button, Alert } from "./ui";
import { customer, ApiError, type QrisResult } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { CheckIcon } from "./icons";

const PRESETS = [5000, 10000, 20000, 50000, 100000, 200000];

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
};

type Stage =
  | { kind: "amount" }
  | { kind: "processing" }
  | { kind: "qris"; data: QrisResult }
  | { kind: "done" };

export default function TopupSheet({ open, onClose, onDone }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "amount" });
  const [amount, setAmount] = useState<number>(10000);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStage({ kind: "amount" });
    setAmount(10000);
    setError(null);
  }

  function handleClose() {
    if (stage.kind === "done") onDone();
    reset();
    onClose();
  }

  async function submit() {
    setError(null);
    if (!Number.isInteger(amount) || amount < 1000) {
      setError("Minimal isi saldo Rp1.000.");
      return;
    }
    setStage({ kind: "processing" });
    try {
      const res = await customer.topup(amount);
      setStage({ kind: "qris", data: res });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal membuat top-up.");
      setStage({ kind: "amount" });
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title={stage.kind === "amount" ? "Isi Saldo" : undefined}>
      {stage.kind === "amount" ? (
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="grid grid-cols-3 gap-2.5">
            {PRESETS.map((p) => {
              const active = amount === p;
              return (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={`rounded-2xl py-3 text-[14px] font-bold transition-all ${
                    active
                      ? "bg-azure text-white shadow-qa"
                      : "bg-white border border-line text-ink hover:border-azure"
                  }`}
                >
                  {rupiah(p)}
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="block text-[13px] font-semibold text-ink mb-1.5">Atau nominal lain</span>
            <div className="flex items-center gap-2 rounded-2xl bg-white border border-line px-4 focus-within:border-azure focus-within:ring-2 focus-within:ring-azure/20 transition-all">
              <span className="text-muted font-semibold">Rp</span>
              <input
                type="number"
                inputMode="numeric"
                min={1000}
                step={1000}
                value={amount || ""}
                onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))}
                className="flex-1 bg-transparent py-3.5 text-[15px] text-ink outline-none"
                placeholder="0"
              />
            </div>
          </label>

          <Button fullWidth onClick={submit}>
            Lanjut Bayar
          </Button>
        </div>
      ) : stage.kind === "processing" ? (
        <div className="py-12 grid place-items-center text-muted text-[14px] gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-haze border-t-azure animate-spin" />
          Memproses…
        </div>
      ) : stage.kind === "qris" ? (
        <div>
          <h2 className="text-lg font-extrabold text-ink mb-4 px-1">Bayar QRIS</h2>
          <QrisPane
            reference={stage.data.reference}
            qrUrl={stage.data.payment.qrUrl}
            totalAmount={stage.data.payment.totalAmount}
            expiresAt={stage.data.payment.expiresAt}
            onPaid={() => {
              onDone();
              setStage({ kind: "done" });
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center pt-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
              <CheckIcon size={28} strokeWidth={2.6} />
            </div>
            <p className="mt-3 font-extrabold text-ink text-lg">Saldo bertambah!</p>
            <p className="text-[13px] text-muted">Saldo POCER kamu sudah diperbarui.</p>
          </div>
          <Button fullWidth onClick={handleClose}>
            Selesai
          </Button>
        </div>
      )}
    </Sheet>
  );
}
