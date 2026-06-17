"use client";

import { useEffect, useState } from "react";
import { agent, type Wallet, type QrisResult, ApiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import { WalletIcon, CheckIcon } from "@/components/icons";
import QrisPane from "@/components/QrisPane";

const PRESETS = [50000, 100000, 200000, 500000];

export default function AgentTopup() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qris, setQris] = useState<QrisResult | null>(null);
  const [done, setDone] = useState(false);

  async function loadWallet() {
    try {
      setWallet(await agent.wallet());
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadWallet();
  }, []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Nominal tidak valid.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      setQris(await agent.topup(amt));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal membuat top-up.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="pt-2">
        <div className="flex flex-col items-center text-center py-10">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
            <CheckIcon size={32} strokeWidth={2.6} />
          </div>
          <h1 className="mt-4 text-[20px] font-extrabold text-ink">Saldo berhasil ditambah</h1>
          {wallet && (
            <p className="text-[14px] text-muted mt-1">
              Saldo sekarang <span className="font-bold text-ink">Rp{rupiah(wallet.balance)}</span>
            </p>
          )}
        </div>
        <Button
          fullWidth
          onClick={() => {
            setDone(false);
            setQris(null);
            setAmount("");
          }}
        >
          Selesai
        </Button>
      </div>
    );
  }

  if (qris) {
    return (
      <div className="pt-2">
        <PageTitle title="Bayar top-up" subtitle="Scan QRIS untuk menambah saldo." />
        <Card className="p-5">
          <QrisPane
            reference={qris.reference}
            qrUrl={qris.payment.qrUrl}
            totalAmount={qris.payment.totalAmount}
            expiresAt={qris.payment.expiresAt}
            onPaid={async () => {
              await loadWallet();
              setDone(true);
            }}
          />
        </Card>
        <Button variant="ghost" fullWidth onClick={() => setQris(null)} className="mt-3">
          Batal
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Isi saldo" subtitle="Tambah saldo dompet via QRIS." />

      <Card className="p-5 bg-inbox text-white border-0 mb-5 relative overflow-hidden">
        <div className="absolute inset-0 hero-glow" />
        <div className="relative flex items-center gap-2 text-white/70 text-[13px] font-semibold">
          <WalletIcon size={18} /> Saldo saat ini
        </div>
        <div className="relative text-[28px] font-extrabold mt-1">
          <span className="opacity-60 text-[17px]">Rp</span> {wallet ? rupiah(wallet.balance) : "…"}
        </div>
      </Card>

      <form onSubmit={start} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              className={`rounded-xl px-3.5 py-2.5 text-[14px] font-bold border transition-colors ${
                amount === String(p) ? "bg-azure text-white border-azure" : "bg-white text-muted border-line"
              }`}
            >
              {p.toLocaleString("id-ID")}
            </button>
          ))}
        </div>
        <TextField
          label="Nominal top-up"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          prefix="Rp"
          required
        />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Lanjut bayar
        </Button>
      </form>
    </div>
  );
}
