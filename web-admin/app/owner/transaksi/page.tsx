"use client";

import { useEffect, useState } from "react";
import { owner, type Transaction, ApiError } from "@/lib/api";
import { rupiah, formatExpiry } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, EmptyState, Skeleton } from "@/components/kit";
import { TextField, Alert } from "@/components/ui";
import { SearchIcon, ReceiptIcon } from "@/components/icons";
import { Button } from "@/components/ui";

const STATUSES = [
  { key: "", label: "Semua" },
  { key: "PAID", label: "Lunas" },
  { key: "UNPAID", label: "Belum bayar" },
  { key: "EXPIRED", label: "Kedaluwarsa" },
  { key: "FAILED", label: "Gagal" },
];

function statusTone(s: string): "success" | "warn" | "danger" | "neutral" {
  if (s === "PAID") return "success";
  if (s === "UNPAID") return "warn";
  if (s === "FAILED") return "danger";
  return "neutral";
}

export default function OwnerTransactions() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Transaction[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Selection state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteOk, setDeleteOk] = useState<string | null>(null);

  async function load() {
    setRows(null);
    setSelected(new Set());
    try {
      setRows(await owner.transactions({ search: search.trim() || undefined, status: status || undefined, limit: 150 }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat transaksi.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!rows) return;
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  async function handleDelete() {
    if (!selected.size) return;
    setDeleteErr(null);
    setDeleteOk(null);
    setDeleting(true);
    try {
      const res = await owner.deleteTransactions(Array.from(selected));
      setDeleteOk(`${res.deleted} transaksi berhasil dihapus.`);
      await load();
    } catch (e) {
      setDeleteErr(e instanceof ApiError ? e.message : "Gagal menghapus transaksi.");
    } finally {
      setDeleting(false);
    }
  }

  const allChecked = !!rows && rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0;

  return (
    <div>
      <PageTitle title="Transaksi" subtitle="Voucher terjual & order di semua outlet Anda." />

      {err && <Alert tone="error">{err}</Alert>}

      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        className="mb-3"
      >
        <TextField
          label=""
          placeholder="Cari no.WA / username voucher / ref"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<SearchIcon size={18} />}
        />
      </form>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold border transition-colors ${
              status === s.key ? "bg-azure text-white border-azure" : "bg-white text-muted border-line"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar — muncul saat ada yang dipilih */}
      {someChecked && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3">
          <span className="flex-1 text-[13px] font-semibold text-rose-800">
            {selected.size} transaksi dipilih
          </span>
          <Button
            type="button"
            className="!bg-rose-600 !py-2 !px-4 text-[13px]"
            loading={deleting}
            onClick={handleDelete}
          >
            Hapus yang dipilih
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[13px] font-semibold text-rose-600 hover:text-rose-800"
          >
            Batal
          </button>
        </div>
      )}

      {deleteErr && <Alert tone="error">{deleteErr}</Alert>}
      {deleteOk && <Alert tone="success">{deleteOk}</Alert>}

      {!rows ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ReceiptIcon size={24} />} title="Tidak ada transaksi" hint="Coba ubah pencarian/filter." />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {/* Header pilih semua */}
          <div className="px-4 py-2.5 flex items-center gap-3 bg-haze">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-line accent-azure cursor-pointer"
            />
            <span className="text-[12px] font-semibold text-muted">
              {allChecked ? "Batalkan semua" : "Pilih semua"}
            </span>
            {someChecked && (
              <span className="ml-auto text-[12px] text-rose-600 font-semibold">
                {selected.size} dipilih
              </span>
            )}
          </div>

          {rows.map((t) => (
            <div
              key={t.id}
              onClick={() => toggleOne(t.id)}
              className={`px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                selected.has(t.id) ? "bg-rose-50" : "hover:bg-haze/60"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggleOne(t.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-line accent-azure cursor-pointer shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-ink truncate">{t.package}</span>
                  {t.outlet && <Badge tone="neutral">{t.outlet.code}</Badge>}
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </div>
                <div className="text-[12px] text-muted truncate mt-0.5">
                  {formatExpiry(t.createdAt)}
                  {t.voucher ? ` · ${t.voucher}` : ""}
                  {t.agent ? ` · ${t.agent.name}` : ""}
                  {t.customerWhatsapp && t.customerWhatsapp !== "-" ? ` · ${t.customerWhatsapp}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-extrabold text-ink text-[14px]">Rp{rupiah(t.amount)}</div>
                <div className="text-[11px] text-muted">{t.fundingSource === "WALLET" ? "saldo" : "QRIS"}</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
