"use client";

import { useEffect, useState } from "react";
import { owner, type CustomerRow, ApiError } from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Money, Badge, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { SearchIcon, WalletIcon, PlusIcon } from "@/components/icons";

export default function OwnerCustomers() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [topupFor, setTopupFor] = useState<CustomerRow | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function load(q?: string) {
    setRows(null);
    try {
      setRows(await owner.customers(q));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat pelanggan.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageTitle title="Pelanggan" subtitle="Pelanggan yang bertransaksi di outlet Anda." />

      {err && <Alert tone="error">{err}</Alert>}
      {okMsg && <div className="mb-3"><Alert tone="success">{okMsg}</Alert></div>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(search.trim() || undefined);
        }}
        className="mb-4"
      >
        <TextField
          label=""
          placeholder="Cari nama / nomor / username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<SearchIcon size={18} />}
        />
      </form>

      <div className="space-y-2.5">
        {!rows ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[64px]" />)
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<WalletIcon size={24} />}
              title="Tidak ada pelanggan"
              hint="Pelanggan muncul setelah ada transaksi di outlet Anda."
            />
          </Card>
        ) : (
          rows.map((c) => (
            <Card key={c.id} className="p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-haze text-azure grid place-items-center font-extrabold">
                {(c.name || c.phone).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink truncate">{c.name || "Tanpa nama"}</span>
                  {c.status !== "ACTIVE" && <Badge tone="danger">nonaktif</Badge>}
                </div>
                <div className="text-[12px] text-muted truncate">
                  {c.phone}
                  {c.username ? ` · @${c.username}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-muted">saldo</div>
                <div className="font-extrabold text-ink text-[14px]">
                  <Money value={c.balance} />
                </div>
              </div>
              <button
                onClick={() => setTopupFor(c)}
                className="shrink-0 h-9 w-9 rounded-xl bg-haze text-azure grid place-items-center"
                aria-label="Top-up"
              >
                <PlusIcon size={18} />
              </button>
            </Card>
          ))
        )}
      </div>

      <TopupSheet
        customer={topupFor}
        onClose={() => setTopupFor(null)}
        onDone={(msg) => {
          setTopupFor(null);
          setOkMsg(msg);
          load(search.trim() || undefined);
        }}
      />
    </div>
  );
}

function TopupSheet({
  customer,
  onClose,
  onDone,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setAmount("");
      setNote("");
      setErr(null);
    }
  }, [customer]);

  const presets = [10000, 20000, 50000, 100000];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Nominal tidak valid.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      await owner.topupCustomer({ customerId: customer.id, amount: amt, note: note.trim() || undefined });
      onDone(`Saldo ${customer.name || customer.phone} ditambah Rp${amt.toLocaleString("id-ID")}.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal top-up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!customer} onClose={onClose} title={customer ? `Top-up · ${customer.name || customer.phone}` : ""}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              className={`rounded-xl px-3 py-2 text-[13px] font-bold border transition-colors ${
                amount === String(p) ? "bg-azure text-white border-azure" : "bg-white text-muted border-line"
              }`}
            >
              {p.toLocaleString("id-ID")}
            </button>
          ))}
        </div>
        <TextField
          label="Nominal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          prefix="Rp"
          required
        />
        <TextField label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. setor tunai" />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Tambah saldo
        </Button>
      </form>
    </Sheet>
  );
}
