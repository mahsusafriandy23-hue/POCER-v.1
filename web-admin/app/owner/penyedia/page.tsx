"use client";

import { useEffect, useState } from "react";
import {
  owner,
  ApiError,
  type Provider,
  type ProviderDetail,
  type PlatformOutlet,
} from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { BoxIcon, StoreIcon, UsersIcon } from "@/components/icons";

export default function PenyediaLayanan() {
  const [rows, setRows] = useState<Provider[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [assignFor, setAssignFor] = useState<Provider | null>(null);
  const [detailFor, setDetailFor] = useState<Provider | null>(null);

  async function reload() {
    setErr(null);
    try {
      setRows(await owner.providers.list());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat penyedia layanan.");
      setRows([]);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageTitle
          title="Penyedia Layanan"
          subtitle="Kelola penyedia layanan (pemilik bisnis) dan outlet yang mereka pegang."
        />
        <Button className="shrink-0 !py-2.5 !px-4" onClick={() => setCreating(true)}>
          + Penyedia
        </Button>
      </div>

      {err && <Alert tone="error">{err}</Alert>}

      <div className="space-y-2.5">
        {!rows ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[96px]" />)
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState icon={<BoxIcon size={24} />} title="Belum ada penyedia layanan" hint="Tambah penyedia untuk mulai." />
          </Card>
        ) : (
          rows.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-haze text-azure grid place-items-center shrink-0">
                  <BoxIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink truncate">{p.brandName || p.name}</span>
                    {p.isOperator && <Badge tone="azure">Operator (Anda)</Badge>}
                    {p.manageAllOutlets && <Badge tone="neutral">Semua outlet</Badge>}
                    {p.status !== "ACTIVE" && <Badge tone="warn">Nonaktif</Badge>}
                  </div>
                  <div className="text-[12px] text-muted mt-0.5">
                    @{p.username}
                    {p.phone ? ` · ${p.phone}` : ""} · {p.outletCount} outlet · {p.agentCount} agen
                  </div>
                  {p.outlets.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {p.outlets.map((o) => (
                        <span key={o.id} className="text-[11px] font-semibold bg-haze text-muted rounded-full px-2 py-0.5">
                          {o.code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="soft" className="flex-1 !py-2.5" onClick={() => setDetailFor(p)}>
                  Detail
                </Button>
                <Button variant="soft" className="flex-1 !py-2.5" onClick={() => setAssignFor(p)}>
                  Atur outlet
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <CreateProviderSheet open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />
      <AssignOutletsSheet
        provider={assignFor}
        onClose={() => setAssignFor(null)}
        onSaved={() => { setAssignFor(null); reload(); }}
      />
      <ProviderDetailSheet provider={detailFor} onClose={() => setDetailFor(null)} onChanged={reload} />
    </div>
  );
}

function CreateProviderSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(""); setBrandName(""); setUsername(""); setPhone(""); setPassword(""); setErr(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Nama wajib diisi.");
    if (!/^[a-z0-9._]{3,20}$/.test(username.trim())) return setErr("Username 3-20 huruf kecil/angka/._");
    if (password.length < 6) return setErr("Password minimal 6 karakter.");
    setLoading(true);
    try {
      await owner.providers.create({
        name: name.trim(),
        brandName: brandName.trim() || undefined,
        username: username.trim(),
        password,
        phone: phone.trim() || undefined,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal membuat penyedia.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Penyedia layanan baru">
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama pemilik" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Pak Muhasis" required />
        <TextField label="Nama brand / layanan" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="mis. Muhasis Net" hint="Nama yang dilihat pelanggan. Kosong = pakai nama pemilik." />
        <TextField label="Username login" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="mis. muhasis" required />
        <TextField label="Nomor WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="mis. 0813..." />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Min 6 karakter. Penyedia login pakai ini." required />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>Buat penyedia</Button>
      </form>
    </Sheet>
  );
}

function AssignOutletsSheet({ provider, onClose, onSaved }: { provider: Provider | null; onClose: () => void; onSaved: () => void }) {
  const [all, setAll] = useState<PlatformOutlet[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!provider) return;
    setErr(null);
    setSelected(new Set(provider.outlets.map((o) => o.id)));
    owner.providers.outlets().then(setAll).catch(() => setAll([]));
  }, [provider]);

  function toggle(id: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function save() {
    if (!provider) return;
    setErr(null);
    setLoading(true);
    try {
      await owner.providers.assignOutlets(provider.id, [...selected]);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan outlet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!provider} onClose={onClose} title={provider ? `Atur outlet · ${provider.brandName || provider.name}` : ""}>
      <div className="space-y-3.5">
        <p className="text-[12px] text-muted">
          Centang outlet yang dipegang penyedia ini. Outlet yang sudah dipegang penyedia lain akan
          dipindahkan ke penyedia ini.
        </p>
        {!all ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[52px]" />)}</div>
        ) : all.length === 0 ? (
          <EmptyState icon={<StoreIcon size={22} />} title="Belum ada outlet" />
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {all.map((o) => {
              const on = selected.has(o.id);
              const otherOwner = o.ownerAdminId && o.ownerAdminId !== provider?.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={`w-full flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                    on ? "bg-azure/10 border-azure" : "bg-white border-line hover:border-azure/40"
                  }`}
                >
                  <span className={`h-5 w-5 rounded-md grid place-items-center text-[12px] font-bold ${on ? "bg-azure text-white" : "bg-haze text-muted"}`}>
                    {on ? "✓" : ""}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-bold text-ink">{o.name}</span>{" "}
                    <span className="text-[12px] text-muted">{o.code}</span>
                    {otherOwner && !on && <span className="block text-[11px] text-amber-600">dipegang penyedia lain</span>}
                  </span>
                  {!o.isActive && <Badge tone="warn">nonaktif</Badge>}
                </button>
              );
            })}
          </div>
        )}
        {err && <Alert tone="error">{err}</Alert>}
        <Button fullWidth loading={loading} onClick={save}>Simpan ({selected.size} outlet)</Button>
      </div>
    </Sheet>
  );
}

function ProviderDetailSheet({ provider, onClose, onChanged }: { provider: Provider | null; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [password, setPassword] = useState("");
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    setDetail(null);
    setErr(null);
    setEditing(false);
    setSavedOk(false);
    if (provider) owner.providers.get(provider.id).then((d) => {
      setDetail(d);
      setName(d.name);
      setBrand(d.brandName ?? "");
      setPassword("");
    }).catch((e) => setErr(e instanceof ApiError ? e.message : "Gagal memuat."));
  }, [provider]);

  async function saveEdit() {
    if (!detail) return;
    if (!name.trim()) return setErr("Nama wajib diisi.");
    if (password && password.length < 6) return setErr("Password baru minimal 6 karakter.");
    setErr(null); setBusy(true); setSavedOk(false);
    try {
      await owner.providers.update(detail.id, {
        name: name.trim(),
        brandName: brand.trim(),
        ...(password ? { password } : {}),
      });
      setDetail({ ...detail, name: name.trim(), brandName: brand.trim() });
      setPassword("");
      setEditing(false);
      setSavedOk(true);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    if (!detail) return;
    setBusy(true);
    setErr(null);
    try {
      const next = detail.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      await owner.providers.update(detail.id, { status: next });
      setDetail({ ...detail, status: next });
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal mengubah status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!provider} onClose={onClose} title={provider ? (provider.brandName || provider.name) : ""}>
      {!detail ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[40px]" />)}</div>
      ) : (
        <div className="space-y-4">
          {!editing ? (
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] text-muted">
                <div><b className="text-ink">{detail.name}</b> · @{detail.username}</div>
                {detail.brandName && <div>Brand: <b className="text-ink">{detail.brandName}</b></div>}
                {detail.phone && <div>WhatsApp: {detail.phone}</div>}
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={detail.status === "ACTIVE" ? "success" : "warn"}>{detail.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</Badge>
                  {detail.isOperator && <Badge tone="azure">Operator</Badge>}
                </div>
              </div>
              <Button variant="soft" className="!py-2 !px-3.5 shrink-0" onClick={() => { setEditing(true); setSavedOk(false); }}>
                Edit
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-line p-3.5 space-y-3">
              <div className="text-[13px] font-extrabold text-ink">Edit penyedia · @{detail.username}</div>
              <TextField label="Nama pemilik" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField label="Nama brand / layanan" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="mis. POCER" hint="Nama yang dilihat pelanggan. Username login tidak bisa diubah." />
              <TextField label="Password baru" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kosongkan jika tidak diganti" hint="Min 6 karakter. Reset password penyedia ini." />
              <div className="flex gap-2">
                <Button variant="soft" className="flex-1" onClick={() => { setEditing(false); setName(detail.name); setBrand(detail.brandName ?? ""); setPassword(""); setErr(null); }} disabled={busy}>Batal</Button>
                <Button className="flex-1" loading={busy} onClick={saveEdit}>Simpan</Button>
              </div>
            </div>
          )}
          {savedOk && <Alert tone="success">Perubahan penyedia disimpan.</Alert>}

          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-ink mb-1.5"><StoreIcon size={15} /> Outlet ({detail.outlets.length})</div>
            {detail.outlets.length === 0 ? (
              <p className="text-[12px] text-muted">Belum ada outlet. Pakai "Atur outlet".</p>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {detail.outlets.map((o) => (
                  <span key={o.id} className="text-[12px] font-semibold bg-haze text-ink rounded-full px-2.5 py-1">{o.name} · {o.code}</span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-ink mb-1.5"><UsersIcon size={15} /> Agen ({detail.agents.length})</div>
            {detail.agents.length === 0 ? (
              <p className="text-[12px] text-muted">Belum ada agen. Penyedia menambahkan agennya sendiri.</p>
            ) : (
              <div className="space-y-1.5">
                {detail.agents.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-[13px] bg-white border border-line rounded-xl px-3 py-2">
                    <span className="font-semibold text-ink">{a.name} <span className="text-muted font-normal">{a.username ? `@${a.username}` : a.phone}</span></span>
                    <Badge tone={a.status === "ACTIVE" ? "success" : "warn"}>{a.status === "ACTIVE" ? "aktif" : "nonaktif"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {err && <Alert tone="error">{err}</Alert>}
          {!detail.isOperator && (
            <Button variant="soft" fullWidth loading={busy} onClick={toggleStatus}>
              {detail.status === "ACTIVE" ? "Nonaktifkan penyedia" : "Aktifkan penyedia"}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
