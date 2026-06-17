"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { owner, type OwnerOutlet, type Brand, type VoucherCharset, type VoucherUserMode, ApiError } from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, Switch, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { StoreIcon, TagIcon, ChevronRightIcon } from "@/components/icons";

export default function OwnerOutlets() {
  const [rows, setRows] = useState<OwnerOutlet[] | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<OwnerOutlet | null>(null);
  const [creating, setCreating] = useState(false);

  const brandName = (id?: number | null) => brands.find((b) => b.id === id)?.name ?? null;

  async function reload() {
    try {
      const [o, b] = await Promise.all([owner.outlets(), owner.brands.list()]);
      setRows(o);
      setBrands(b);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat outlet.");
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function quickToggle(o: OwnerOutlet, active: boolean) {
    setRows((prev) => prev?.map((x) => (x.id === o.id ? { ...x, isActive: active } : x)) ?? prev);
    try {
      await owner.updateOutlet(o.id, { isActive: active });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal mengubah status outlet.");
      reload();
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageTitle title="Outlet" subtitle="Kelola lokasi/router voucher Anda." />
        <Button className="shrink-0 !py-2.5 !px-4" onClick={() => setCreating(true)}>
          + Outlet
        </Button>
      </div>

      {err && <Alert tone="error">{err}</Alert>}

      <div className="space-y-2.5">
        {!rows ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState icon={<StoreIcon size={24} />} title="Belum ada outlet" />
          </Card>
        ) : (
          rows.map((o) => (
            <Card key={o.id} className="p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-haze text-azure grid place-items-center">
                <StoreIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-ink truncate">{o.name}</span>
                  <Badge tone="neutral">{o.code}</Badge>
                  {brandName(o.brandId) ? (
                    <Badge tone="azure">{brandName(o.brandId)}</Badge>
                  ) : (
                    <Badge tone="warn">tanpa brand</Badge>
                  )}
                  {!o.isActive && <Badge tone="warn">nonaktif</Badge>}
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  {o.packageCount} paket · {o.hasRouter ? "router tersambung" : "router belum diatur"}
                </div>
              </div>
              <Link
                href={`/owner/paket?server=${o.id}`}
                className="hidden sm:inline-flex items-center gap-1 text-[13px] font-bold text-azure rounded-xl px-3 py-2 hover:bg-haze"
              >
                <TagIcon size={16} /> Paket
              </Link>
              <Switch checked={o.isActive} onChange={(v) => quickToggle(o, v)} />
              <Button variant="soft" className="!py-2.5 !px-4" onClick={() => setEditing(o)}>
                Edit
              </Button>
            </Card>
          ))
        )}
      </div>

      <EditOutletSheet
        outlet={editing}
        brands={brands}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

      <CreateOutletSheet
        open={creating}
        brands={brands}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          reload();
        }}
      />
    </div>
  );
}

function CreateOutletSheet({
  open,
  brands,
  onClose,
  onCreated,
}: {
  open: boolean;
  brands: Brand[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setName("");
      setBrandId(brands.length === 1 ? brands[0].id : null);
      setErr(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/.test(c)) {
      setErr("Kode 2-20 huruf besar/angka/-_ (mis. KORLEKO).");
      return;
    }
    if (!name.trim()) {
      setErr("Nama outlet wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      await owner.createOutlet({ code: c, name: name.trim(), ...(brandId ? { brandId } : {}) });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal membuat outlet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Outlet baru">
      <form onSubmit={submit} className="space-y-3.5">
        <TextField
          label="Kode outlet"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="mis. KORLEKO"
          hint="Huruf besar/angka, tetap setelah dibuat. Dipakai sebagai pengenal unik."
          required
        />
        <TextField label="Nama outlet" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Korleko" required />
        <div>
          <span className="block text-[13px] font-semibold text-ink mb-1.5">Brand</span>
          <select
            value={brandId ?? ""}
            onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl bg-haze border border-line px-3 py-2.5 text-[13px] text-ink outline-none focus:border-azure"
          >
            <option value="">— tanpa brand —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="block text-[12px] text-muted mt-1">Pembayaran outlet ini masuk ke QRIS brand terpilih.</span>
        </div>
        <p className="text-[12px] text-muted">
          Outlet baru langsung milik Anda. Pengaturan router (IP/kredensial MikroTik) dilakukan oleh
          operator platform setelah outlet dibuat.
        </p>
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Buat outlet
        </Button>
      </form>
    </Sheet>
  );
}

function EditOutletSheet({
  outlet,
  brands,
  onClose,
  onSaved,
}: {
  outlet: OwnerOutlet | null;
  brands: Brand[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [charset, setCharset] = useState<VoucherCharset>("numeric");
  const [userMode, setUserMode] = useState<VoucherUserMode>("USER_PASS");
  const [length, setLength] = useState(6);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (outlet) {
      setName(outlet.name);
      setActive(outlet.isActive);
      setBrandId(outlet.brandId ?? null);
      setCharset(outlet.voucherCharset ?? "numeric");
      setUserMode(outlet.voucherUserMode ?? "USER_PASS");
      setLength(outlet.voucherLength ?? 6);
      setErr(null);
    }
  }, [outlet]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outlet) return;
    if (!name.trim()) {
      setErr("Nama outlet wajib diisi.");
      return;
    }
    if (length < 4 || length > 12) {
      setErr("Panjang kode 4–12 digit.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      await owner.updateOutlet(outlet.id, {
        name: name.trim(),
        isActive: active,
        ...(brandId && brandId !== outlet.brandId ? { brandId } : {}),
      });
      await owner.updateVoucherFormat(outlet.id, {
        voucherCharset: charset,
        voucherUserMode: userMode,
        voucherLength: length,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan outlet.");
    } finally {
      setLoading(false);
    }
  }

  // Live example of the chosen voucher style.
  const sample = (() => {
    const pool = charset === "numeric" ? "0123456789" : "23456789abcdefghjkmnpqrstuvwxyz";
    const gen = () =>
      Array.from({ length }, (_, i) => pool[(i * 7 + length) % pool.length]).join("");
    const u = gen();
    const p = userMode === "USER_EQ_PASS" ? u : gen().split("").reverse().join("");
    return { u, p, same: userMode === "USER_EQ_PASS" };
  })();

  return (
    <Sheet open={!!outlet} onClose={onClose} title={outlet ? `Edit outlet · ${outlet.code}` : ""}>
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama outlet" value={name} onChange={(e) => setName(e.target.value)} required />
        <div>
          <span className="block text-[13px] font-semibold text-ink mb-1.5">Brand</span>
          <select
            value={brandId ?? ""}
            onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl bg-haze border border-line px-3 py-2.5 text-[13px] text-ink outline-none focus:border-azure"
          >
            <option value="">— tanpa brand —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="block text-[12px] text-muted mt-1">
            Memindah brand otomatis mengarahkan pembayaran outlet ini ke QRIS brand baru.
          </span>
        </div>
        <div className="rounded-2xl bg-white border border-line px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-ink">Outlet aktif</span>
          <Switch checked={active} onChange={setActive} />
        </div>

        {/* Jenis voucher (per-outlet) */}
        <div className="rounded-2xl bg-white border border-line p-4 space-y-3.5">
          <div className="text-[14px] font-extrabold text-ink">Jenis Voucher</div>

          <Segmented
            label="Format kode"
            value={charset}
            onChange={(v) => setCharset(v as VoucherCharset)}
            options={[
              { value: "numeric", label: "Angka semua", hint: "0-9" },
              { value: "alphanumeric", label: "Campuran", hint: "huruf+angka" },
            ]}
          />
          <Segmented
            label="Mode login"
            value={userMode}
            onChange={(v) => setUserMode(v as VoucherUserMode)}
            options={[
              { value: "USER_PASS", label: "User & Password", hint: "beda" },
              { value: "USER_EQ_PASS", label: "User = Password", hint: "satu kode" },
            ]}
          />
          <TextField
            label="Panjang kode"
            value={String(length)}
            onChange={(e) => setLength(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
            inputMode="numeric"
            hint="4–12 karakter per kolom."
          />

          <div className="rounded-xl bg-haze px-3.5 py-3 text-[13px]">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">Contoh hasil</div>
            <div className="font-mono text-ink">
              User: <b>{sample.u}</b>
              {sample.same ? (
                <span className="text-muted"> · Password sama dengan user</span>
              ) : (
                <>
                  {" "}· Pass: <b>{sample.p}</b>
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted">
            Sesuaikan dengan mode login hotspot di router outlet ini.
          </p>
        </div>

        <p className="text-[12px] text-muted">
          Kode outlet ({outlet?.code}) bersifat tetap. Pengaturan router dilakukan oleh operator platform.
        </p>
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Simpan
        </Button>
      </form>
    </Sheet>
  );
}

function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint?: string }[];
}) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-ink mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                on ? "bg-azure/10 border-azure" : "bg-white border-line hover:border-azure/40"
              }`}
            >
              <div className={`text-[13px] font-bold ${on ? "text-azure" : "text-ink"}`}>{o.label}</div>
              {o.hint && <div className="text-[11px] text-muted">{o.hint}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
