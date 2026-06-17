"use client";

import { useEffect, useState } from "react";
import { owner, type CustomerRow, type CustomerDetail, type Ledger, ApiError } from "@/lib/api";
import { rupiah, humanDuration, formatDate } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, Money, Badge, EmptyState, Skeleton, SectionTitle } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import {
  SearchIcon, WalletIcon, PlusIcon, UserIcon, ChevronRightIcon,
  EyeIcon, EyeOffIcon, TrashIcon, EditIcon,
} from "@/components/icons";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OwnerCustomers() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editFor, setEditFor] = useState<CustomerRow | null>(null);
  const [topupFor, setTopupFor] = useState<CustomerRow | null>(null);

  async function load(q?: string) {
    setRows(null);
    try { setRows(await owner.customers(q)); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Gagal memuat pelanggan."); }
  }
  useEffect(() => { load(); }, []);

  function flash(msg: string) { setOkMsg(msg); setTimeout(() => setOkMsg(null), 4000); }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <PageTitle title="Pelanggan" subtitle="Kelola akun pelanggan di outlet Anda." />
        <Button className="shrink-0 !py-2.5 !px-4" onClick={() => setCreating(true)}>
          <PlusIcon size={16} /> Baru
        </Button>
      </div>

      {err && <Alert tone="error">{err}</Alert>}
      {okMsg && <div className="mb-3"><Alert tone="success">{okMsg}</Alert></div>}

      <form onSubmit={(e) => { e.preventDefault(); load(search.trim() || undefined); }} className="mb-4">
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
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState icon={<UserIcon size={24} />} title="Tidak ada pelanggan" hint="Tambah pelanggan pertama atau tunggu ada transaksi di outlet Anda." />
          </Card>
        ) : (
          rows.map((c) => (
            <Card key={c.id} className="p-3.5 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-haze text-azure grid place-items-center font-extrabold text-[15px]">
                {(c.name || c.phone).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-ink text-[14px] truncate">{c.name || "Tanpa nama"}</span>
                  {c.status !== "ACTIVE" && <Badge tone="danger">nonaktif</Badge>}
                </div>
                <div className="text-[12px] text-muted truncate">
                  {c.phone}{c.username ? ` · @${c.username}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0 mr-1">
                <div className="text-[11px] text-muted">saldo</div>
                <div className="font-extrabold text-ink text-[13px]"><Money value={c.balance} /></div>
              </div>
              {/* action buttons */}
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setTopupFor(c)}
                  className="h-8 w-8 rounded-xl bg-haze text-azure grid place-items-center"
                  title="Top-up saldo"
                >
                  <WalletIcon size={15} />
                </button>
                <button
                  onClick={() => setEditFor(c)}
                  className="h-8 w-8 rounded-xl bg-haze text-muted grid place-items-center"
                  title="Edit pelanggan"
                >
                  <EditIcon size={15} />
                </button>
                <button
                  onClick={() => setDetailId(c.id)}
                  className="h-8 w-8 rounded-xl bg-haze text-muted grid place-items-center"
                  title="Lihat detail"
                >
                  <ChevronRightIcon size={15} />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Sheets */}
      <CreateCustomerSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(msg) => { setCreating(false); flash(msg); load(search.trim() || undefined); }}
      />
      <EditCustomerSheet
        customer={editFor}
        onClose={() => setEditFor(null)}
        onSaved={(msg) => { setEditFor(null); flash(msg); load(search.trim() || undefined); }}
        onDeleted={(msg) => { setEditFor(null); flash(msg); load(search.trim() || undefined); }}
      />
      <TopupSheet
        customer={topupFor}
        onClose={() => setTopupFor(null)}
        onDone={(msg) => { setTopupFor(null); flash(msg); load(search.trim() || undefined); }}
      />
      <DetailSheet
        customerId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(c) => { setDetailId(null); setEditFor(c); }}
        onTopup={(c) => { setDetailId(null); setTopupFor(c); }}
      />
    </div>
  );
}

// ─── Create ───────────────────────────────────────────────────────────────────

function CreateCustomerSheet({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setName(""); setPhone(""); setUsername(""); setPassword(""); setErr(null); }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const c = await owner.createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        ...(username.trim() ? { username: username.trim().toLowerCase() } : {}),
        password,
      });
      onCreated(`Pelanggan ${c.name || c.phone} berhasil dibuat.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal membuat pelanggan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Pelanggan baru">
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Budi Santoso" required />
        <TextField label="No. HP / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="08123456789" required />
        <TextField label="Username (opsional)" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mis. budi123" autoCapitalize="none" hint="3-20 huruf kecil, angka, . atau _" />
        <TextField
          label="Kata sandi"
          type={showPw ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="min. 6 karakter"
          required
          suffix={
            <button type="button" onClick={() => setShowPw((s) => !s)} className="text-muted p-1" tabIndex={-1}>
              {showPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          }
        />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>Buat pelanggan</Button>
      </form>
    </Sheet>
  );
}

// ─── Edit / Delete ────────────────────────────────────────────────────────────

function EditCustomerSheet({
  customer, onClose, onSaved, onDeleted,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onDeleted: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setName(customer.name ?? "");
      setPhone(customer.phone ?? "");
      setUsername(customer.username ?? "");
      setNewPassword("");
      setErr(null);
      setConfirmDel(false);
    }
  }, [customer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setErr(null);
    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (name.trim() && name.trim() !== customer.name) body.name = name.trim();
      if (phone.trim() && phone.trim() !== customer.phone) body.phone = phone.trim();
      if (username.trim().toLowerCase() !== (customer.username ?? "")) body.username = username.trim().toLowerCase();
      if (newPassword.trim()) body.password = newPassword.trim();
      await owner.updateCustomer(customer.id, body);
      onSaved(`Data ${customer.name || customer.phone} diperbarui.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleSuspend() {
    if (!customer) return;
    setErr(null);
    setLoading(true);
    try {
      await owner.updateCustomer(customer.id, { status: customer.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" });
      onSaved(`${customer.name || customer.phone} ${customer.status === "ACTIVE" ? "dinonaktifkan" : "diaktifkan"}.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal mengubah status.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!customer) return;
    setErr(null);
    setDeleting(true);
    try {
      await owner.deleteCustomer(customer.id);
      onDeleted(`Pelanggan ${customer.name || customer.phone} dihapus.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menghapus.");
      setConfirmDel(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet open={!!customer} onClose={onClose} title={customer ? `Edit · ${customer.name || customer.phone}` : ""}>
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama pelanggan" required />
        <TextField label="No. HP" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="08123456789" required />
        <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" placeholder="opsional" hint="Kosongkan untuk hapus username." />
        <TextField
          label="Kata sandi baru (opsional)"
          type={showPw ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Kosongkan = tidak diganti"
          hint="Min. 6 karakter."
          suffix={
            <button type="button" onClick={() => setShowPw((s) => !s)} className="text-muted p-1" tabIndex={-1}>
              {showPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          }
        />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>Simpan perubahan</Button>

        <button
          type="button"
          onClick={toggleSuspend}
          disabled={loading}
          className={`w-full py-2.5 rounded-xl text-[13px] font-bold border transition-colors ${
            customer?.status === "ACTIVE"
              ? "text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100"
              : "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
          }`}
        >
          {customer?.status === "ACTIVE" ? "Nonaktifkan akun" : "Aktifkan kembali"}
        </button>

        <div className="pt-1 border-t border-line">
          {!confirmDel ? (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-rose-600 py-2.5 rounded-xl hover:bg-rose-50 transition-colors"
            >
              <TrashIcon size={15} /> Hapus pelanggan
            </button>
          ) : (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 space-y-3">
              <p className="text-[13px] text-rose-800 font-medium">
                Hapus <b>{customer?.name || customer?.phone}</b>? Akun, saldo, dan voucher akan ikut terhapus. Riwayat transaksi tetap tersimpan.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="soft" className="flex-1" onClick={() => setConfirmDel(false)} disabled={deleting}>Batal</Button>
                <Button type="button" className="flex-1 !bg-rose-600" loading={deleting} onClick={handleDelete}>Ya, hapus</Button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
}

// ─── Detail / Voucher + Riwayat ───────────────────────────────────────────────

function DetailSheet({
  customerId, onClose, onEdit, onTopup,
}: {
  customerId: number | null;
  onClose: () => void;
  onEdit: (c: CustomerRow) => void;
  onTopup: (c: CustomerRow) => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"voucher" | "transaksi">("voucher");
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!customerId) { setDetail(null); return; }
    setLoading(true);
    setErr(null);
    setTab("voucher");
    owner.getCustomer(customerId)
      .then(setDetail)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Gagal memuat detail."))
      .finally(() => setLoading(false));
  }, [customerId]);

  function copyCode(id: number, code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const title = detail ? `${detail.name || detail.phone}` : "Detail pelanggan";

  return (
    <Sheet open={!!customerId} onClose={onClose} title={title}>
      {loading && (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[56px]" />)}
        </div>
      )}
      {err && <Alert tone="error">{err}</Alert>}

      {detail && (
        <div className="space-y-4">
          {/* Info card */}
          <div className="rounded-2xl bg-haze border border-line p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">No. HP</span>
              <span className="font-semibold text-ink text-[13px]">{detail.phone}</span>
            </div>
            {detail.username && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted">Username</span>
                <span className="font-semibold text-ink text-[13px]">@{detail.username}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">Saldo</span>
              <span className="font-extrabold text-azure text-[14px]"><Money value={detail.balance} /></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">Status</span>
              <Badge tone={detail.status === "ACTIVE" ? "success" : "danger"}>
                {detail.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="soft" className="flex-1 !py-2.5" onClick={() => onTopup(detail)}>
              <WalletIcon size={15} /> Top-up
            </Button>
            <Button variant="soft" className="flex-1 !py-2.5" onClick={() => onEdit(detail)}>
              <EditIcon size={15} /> Edit
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-haze border border-line">
            {(["voucher", "transaksi"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                  tab === t ? "bg-white text-ink shadow-sm" : "text-muted"
                }`}
              >
                {t === "voucher" ? `Voucher (${detail.vouchers.length})` : `Transaksi (${detail.transactions.length})`}
              </button>
            ))}
          </div>

          {/* Voucher list */}
          {tab === "voucher" && (
            <div className="space-y-2">
              {detail.vouchers.length === 0 ? (
                <p className="text-center text-[13px] text-muted py-6">Belum ada voucher.</p>
              ) : (
                detail.vouchers.map((v) => (
                  <div key={v.id} className="rounded-xl bg-ink text-white p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] text-white/60">{v.packageName ?? "Voucher"}</span>
                      <Badge tone={v.isActive ? "success" : "neutral"}>{v.isActive ? "aktif" : "tidak aktif"}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[15px] tracking-widest">{v.username}</span>
                      <button
                        onClick={() => copyCode(v.id, v.username)}
                        className="text-[11px] font-bold text-azure/80 hover:text-azure transition-colors"
                      >
                        {copied === v.id ? "✓ Disalin" : "Salin"}
                      </button>
                    </div>
                    {v.expiryDate && (
                      <p className="text-[11px] text-white/50 mt-1">Berlaku s.d. {formatDate(v.expiryDate)}</p>
                    )}
                    {!v.activatedAt && (
                      <p className="text-[11px] text-white/50 mt-1">Belum digunakan</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Transaction list */}
          {tab === "transaksi" && (
            <div className="space-y-2">
              {detail.transactions.length === 0 ? (
                <p className="text-center text-[13px] text-muted py-6">Belum ada transaksi.</p>
              ) : (
                detail.transactions.map((t) => (
                  <div key={t.id} className="rounded-xl bg-white border border-line p-3.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{t.description ?? t.type}</p>
                      <p className="text-[11px] text-muted">{formatDate(t.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-extrabold text-[13px] ${t.direction === "CREDIT" ? "text-emerald-600" : "text-rose-600"}`}>
                        {t.direction === "CREDIT" ? "+" : "-"}Rp{Math.abs(t.amount).toLocaleString("id-ID")}
                      </p>
                      <p className="text-[11px] text-muted">saldo Rp{t.balanceAfter.toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ─── Top-up ───────────────────────────────────────────────────────────────────

function TopupSheet({
  customer, onClose, onDone,
}: { customer: CustomerRow | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (customer) { setAmount(""); setNote(""); setErr(null); } }, [customer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setErr("Nominal tidak valid."); return; }
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
          {[10000, 20000, 50000, 100000].map((p) => (
            <button key={p} type="button" onClick={() => setAmount(String(p))}
              className={`rounded-xl px-3 py-2 text-[13px] font-bold border transition-colors ${amount === String(p) ? "bg-azure text-white border-azure" : "bg-white text-muted border-line"}`}>
              {p.toLocaleString("id-ID")}
            </button>
          ))}
        </div>
        <TextField label="Nominal" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" prefix="Rp" required />
        <TextField label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. setor tunai" />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>Tambah saldo</Button>
      </form>
    </Sheet>
  );
}
