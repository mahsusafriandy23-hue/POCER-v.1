"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { owner, type AgentDetail, type OwnerOutlet, type Brand, ApiError } from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Money, Badge, Switch, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { ArrowLeftIcon, CheckIcon, WalletIcon, TagIcon } from "@/components/icons";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [outlets, setOutlets] = useState<OwnerOutlet[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingOutlets, setSavingOutlets] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function reload() {
    try {
      const [a, o, b] = await Promise.all([owner.agents.get(id), owner.outlets(), owner.brands.list()]);
      setAgent(a);
      setOutlets(o);
      setBrands(b);
      setPicked(a.outlets.map((x) => x.id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat agen.");
    }
  }
  useEffect(() => {
    if (Number.isFinite(id)) reload();
  }, [id]);

  async function toggleStatus(active: boolean) {
    if (!agent) return;
    setErr(null);
    setMsg(null);
    try {
      await owner.agents.update(id, { status: active ? "ACTIVE" : "SUSPENDED" });
      setAgent({ ...agent, status: active ? "ACTIVE" : "SUSPENDED" });
      setMsg(active ? "Agen diaktifkan." : "Agen dinonaktifkan.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal mengubah status.");
    }
  }

  function togglePick(sid: number) {
    setPicked((p) => (p.includes(sid) ? p.filter((x) => x !== sid) : [...p, sid]));
  }

  async function saveOutlets() {
    setErr(null);
    setMsg(null);
    setSavingOutlets(true);
    try {
      await owner.agents.assignOutlets(id, picked);
      setMsg("Outlet agen diperbarui.");
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan outlet.");
    } finally {
      setSavingOutlets(false);
    }
  }

  async function removeAgent() {
    setErr(null);
    setDeleting(true);
    try {
      await owner.agents.remove(id);
      router.replace("/owner/agen");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menghapus agen.");
      setDeleting(false);
      setConfirmDel(false);
    }
  }

  if (!agent) {
    return (
      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-muted text-[14px] font-semibold mb-4">
          <ArrowLeftIcon size={18} /> Kembali
        </button>
        <Skeleton className="h-40" />
      </div>
    );
  }

  // An agent sells only its brand's outlets.
  const brandOutlets = agent.brand ? outlets.filter((o) => o.brandId === agent.brand!.id) : outlets;

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-muted text-[14px] font-semibold mb-4">
        <ArrowLeftIcon size={18} /> Kembali
      </button>

      <div className="flex items-start justify-between gap-3">
        <PageTitle
          title={agent.name}
          subtitle={`${agent.brand ? `${agent.brand.name} · ` : ""}${agent.username ? `@${agent.username} · ` : ""}${agent.phone}`}
        />
        <Button variant="soft" onClick={() => setEditOpen(true)} className="shrink-0 !py-2.5 !px-4">
          Ubah
        </Button>
      </div>

      {err && <Alert tone="error">{err}</Alert>}
      {msg && <div className="mb-3"><Alert tone="success">{msg}</Alert></div>}

      {/* Saldo + status */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-[12px] font-semibold text-muted">Saldo dompet</div>
          <div className="text-[20px] font-extrabold text-ink mt-0.5">
            <Money value={agent.balance} />
          </div>
          <Button variant="soft" onClick={() => setTopupOpen(true)} className="mt-3 !py-2.5">
            <WalletIcon size={16} /> Top-up saldo
          </Button>
        </Card>
        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-muted">Status</span>
            <Switch checked={agent.status === "ACTIVE"} onChange={toggleStatus} />
          </div>
          <div className="mt-2">
            {agent.status === "ACTIVE" ? <Badge tone="success">aktif</Badge> : <Badge tone="danger">nonaktif</Badge>}
          </div>
        </Card>
      </div>

      {/* Agent discount */}
      <div className="mt-4">
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-haze text-azure grid place-items-center">
              <TagIcon size={20} />
            </div>
            <div>
              <div className="font-bold text-ink text-[14px]">Diskon agen</div>
              <div className="text-[12px] text-muted">
                {agent.discountPercent ? `${agent.discountPercent}% dari harga jual` : "tidak ada (pakai harga paket)"}
              </div>
            </div>
          </div>
          <Button variant="soft" onClick={() => setDiscountOpen(true)} className="!py-2.5 !px-4">
            Atur
          </Button>
        </Card>
        <p className="text-[12px] text-muted mt-1.5">
          Dipakai untuk paket yang belum punya "harga agen" khusus. Jika paket sudah punya harga agen, itu yang dipakai.
        </p>
      </div>

      {/* Outlet assignment */}
      <div className="mt-6">
        <h2 className="text-[15px] font-extrabold text-ink mb-1">Outlet yang boleh dijual</h2>
        <p className="text-[13px] text-muted mb-3">
          {agent.brand ? `Outlet brand ${agent.brand.name}.` : "Pilih dari outlet milik Anda."} Agen hanya bisa menjual paket outlet terpilih.
        </p>
        {brandOutlets.length === 0 ? (
          <Card><div className="p-4 text-[13px] text-muted">{agent.brand ? "Brand ini belum punya outlet." : "Anda belum punya outlet."}</div></Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {brandOutlets.map((o) => {
                const on = picked.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => togglePick(o.id)}
                    className={`rounded-xl px-3 py-2 text-[13px] font-bold border transition-colors flex items-center gap-1.5 ${
                      on ? "bg-azure text-white border-azure" : "bg-white text-muted border-line"
                    }`}
                  >
                    {on && <CheckIcon size={14} strokeWidth={3} />}
                    {o.name}
                  </button>
                );
              })}
            </div>
            <Button onClick={saveOutlets} loading={savingOutlets} className="mt-4 !py-3">
              Simpan outlet
            </Button>
          </>
        )}
      </div>

      {/* Security */}
      <div className="mt-7">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">Keamanan</h2>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-ink text-[14px]">Reset kata sandi / PIN</div>
            <div className="text-[12px] text-muted">PIN saat ini: {agent.hasPin ? "terpasang" : "belum diatur"}</div>
          </div>
          <Button variant="soft" onClick={() => setResetOpen(true)} className="!py-2.5 !px-4">
            Ubah
          </Button>
        </Card>
      </div>

      {/* Danger zone */}
      <div className="mt-7">
        <h2 className="text-[15px] font-extrabold text-rose-600 mb-3">Zona berbahaya</h2>
        <Card className="p-4 border-rose-200">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-ink text-[14px]">Hapus agen</div>
              <div className="text-[12px] text-muted">
                Menghapus agen ini beserta penugasan outlet, harga khusus, dan saldo dompetnya.
                Riwayat penjualan tetap tersimpan (tanpa nama agen). Tidak bisa dibatalkan.
              </div>
            </div>
            <Button
              variant="soft"
              onClick={() => setConfirmDel(true)}
              className="shrink-0 !py-2.5 !px-4 !bg-rose-50 !text-rose-600"
            >
              Hapus
            </Button>
          </div>
          {confirmDel && (
            <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3">
              <p className="text-[13px] text-rose-700 font-semibold">
                Yakin hapus agen <b>{agent.name}</b>{agent.balance > 0 ? ` (saldo Rp${agent.balance.toLocaleString("id-ID")} ikut terhapus)` : ""}?
              </p>
              <div className="flex gap-2 mt-2.5">
                <Button onClick={removeAgent} loading={deleting} className="!py-2 !px-4 !bg-rose-600">
                  Ya, hapus
                </Button>
                <Button variant="soft" onClick={() => setConfirmDel(false)} className="!py-2 !px-4">
                  Batal
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <EditAgentSheet
        open={editOpen}
        agentId={id}
        current={agent}
        brands={brands}
        onClose={() => setEditOpen(false)}
        onSaved={(m) => {
          setEditOpen(false);
          setMsg(m);
          reload();
        }}
      />

      <ResetSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onSaved={(m) => {
          setResetOpen(false);
          setMsg(m);
          reload();
        }}
        agentId={id}
      />

      <TopupAgentSheet
        open={topupOpen}
        agentId={id}
        onClose={() => setTopupOpen(false)}
        onSaved={(m) => {
          setTopupOpen(false);
          setMsg(m);
          reload();
        }}
      />

      <DiscountSheet
        open={discountOpen}
        agentId={id}
        current={agent.discountPercent ?? 0}
        onClose={() => setDiscountOpen(false)}
        onSaved={(m) => {
          setDiscountOpen(false);
          setMsg(m);
          reload();
        }}
      />
    </div>
  );
}

function EditAgentSheet({
  open,
  agentId,
  current,
  brands,
  onClose,
  onSaved,
}: {
  open: boolean;
  agentId: number;
  current: AgentDetail;
  brands: Brand[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(current.name);
  const [brandId, setBrandId] = useState<number | null>(current.brand?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(current.name);
      setBrandId(current.brand?.id ?? null);
      setErr(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Nama agen wajib diisi.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      await owner.agents.update(agentId, {
        name: name.trim(),
        ...(brandId && brandId !== current.brand?.id ? { brandId } : {}),
      });
      onSaved(
        brandId !== current.brand?.id
          ? "Agen diperbarui. Outlet di luar brand baru otomatis dilepas — atur ulang di bawah."
          : "Agen diperbarui.",
      );
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan agen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ubah agen">
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama agen" value={name} onChange={(e) => setName(e.target.value)} required />
        <div>
          <span className="block text-[13px] font-semibold text-ink mb-1.5">Brand</span>
          <select
            value={brandId ?? ""}
            onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl bg-haze border border-line px-3 py-2.5 text-[13px] text-ink outline-none focus:border-azure"
          >
            <option value="">— pilih brand —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="block text-[12px] text-muted mt-1">
            Pindah brand otomatis melepas outlet yang bukan milik brand baru.
          </span>
        </div>
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Simpan
        </Button>
      </form>
    </Sheet>
  );
}

function TopupAgentSheet({
  open,
  agentId,
  onClose,
  onSaved,
}: {
  open: boolean;
  agentId: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const presets = [50000, 100000, 200000, 500000];

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setErr(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Nominal tidak valid.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      await owner.agents.topup(agentId, { amount: amt, note: note.trim() || undefined });
      onSaved(`Saldo agen ditambah Rp${amt.toLocaleString("id-ID")}.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal top-up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Top-up saldo agen">
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
        <TextField label="Nominal" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" prefix="Rp" required />
        <TextField label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. setor tunai" />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Tambah saldo
        </Button>
      </form>
    </Sheet>
  );
}

function DiscountSheet({
  open,
  agentId,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  agentId: number;
  current: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pct, setPct] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPct(String(current || ""));
      setErr(null);
    }
  }, [open, current]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = pct.trim() === "" ? 0 : Number(pct);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      setErr("Diskon harus 0–100.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      await owner.agents.update(agentId, { discountPercent: v });
      onSaved(v ? `Diskon agen di-set ${v}%.` : "Diskon agen dihapus.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan diskon.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Atur diskon agen">
      <form onSubmit={submit} className="space-y-3.5">
        <TextField
          label="Diskon (%)"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          inputMode="numeric"
          placeholder="0"
          suffix={<span className="text-muted font-semibold">%</span>}
          hint="Potongan dari harga jual untuk paket tanpa harga agen khusus. Kosong/0 = tanpa diskon."
        />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Simpan
        </Button>
      </form>
    </Sheet>
  );
}

function ResetSheet({
  open,
  onClose,
  onSaved,
  agentId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
  agentId: number;
}) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!password && !pin) {
      setErr("Isi kata sandi atau PIN baru.");
      return;
    }
    setLoading(true);
    try {
      await owner.agents.update(agentId, {
        ...(password ? { password } : {}),
        ...(pin ? { pin } : {}),
      });
      setPassword("");
      setPin("");
      onSaved("Kredensial agen diperbarui.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Reset kata sandi / PIN">
      <form onSubmit={submit} className="space-y-3.5">
        <TextField
          label="Kata sandi baru"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="kosongkan jika tak diubah"
          hint="Minimal 6 karakter."
        />
        <TextField
          label="PIN baru"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          placeholder="kosongkan jika tak diubah"
        />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Simpan
        </Button>
      </form>
    </Sheet>
  );
}
