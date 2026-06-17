"use client";

import { useEffect, useState } from "react";
import { owner, ApiError, type Assistant, type PlatformOutlet } from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, Switch, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { UsersIcon, StoreIcon } from "@/components/icons";

export default function AsistenPage() {
  const [rows, setRows] = useState<Assistant[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [accessFor, setAccessFor] = useState<Assistant | null>(null);

  async function reload() {
    setErr(null);
    try {
      setRows(await owner.assistants.list());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat asisten.");
      setRows([]);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function toggleStatus(a: Assistant) {
    try {
      await owner.assistants.update(a.id, { status: a.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" });
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal mengubah status.");
    }
  }
  async function remove(a: Assistant) {
    if (!confirm(`Hapus asisten "${a.name}"? Akun login-nya akan hilang.`)) return;
    try {
      await owner.assistants.remove(a.id);
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menghapus asisten.");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageTitle title="Asisten" subtitle="User terbatas yang hanya melihat data dari outlet yang Anda izinkan." />
        <Button className="shrink-0 !py-2.5 !px-4" onClick={() => setCreating(true)}>
          + Asisten
        </Button>
      </div>

      {err && <Alert tone="error">{err}</Alert>}

      <div className="space-y-2.5">
        {!rows ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState icon={<UsersIcon size={24} />} title="Belum ada asisten" hint="Tambah asisten dan beri akses outlet." />
          </Card>
        ) : (
          rows.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-haze text-azure grid place-items-center shrink-0">
                  <UsersIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink truncate">{a.name}</span>
                    {a.status !== "ACTIVE" && <Badge tone="warn">nonaktif</Badge>}
                    {a.canSell && <Badge tone="azure">boleh jual</Badge>}
                  </div>
                  <div className="text-[12px] text-muted mt-0.5">@{a.username} · {a.outlets.length} outlet</div>
                  {a.outlets.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {a.outlets.map((o) => (
                        <span key={o.id} className="text-[11px] font-semibold bg-haze text-muted rounded-full px-2 py-0.5">{o.code}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-600 mt-1">Belum diberi akses outlet — belum bisa lihat apa pun.</div>
                  )}
                </div>
                <Switch checked={a.status === "ACTIVE"} onChange={() => toggleStatus(a)} />
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="soft" className="flex-1 !py-2.5" onClick={() => setAccessFor(a)}>
                  Atur akses outlet
                </Button>
                <Button variant="soft" className="!py-2.5 !px-4 !text-rose-600" onClick={() => remove(a)}>
                  Hapus
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <CreateAssistantSheet open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />
      <AccessSheet assistant={accessFor} onClose={() => setAccessFor(null)} onSaved={() => { setAccessFor(null); reload(); }} />
    </div>
  );
}

function OutletPicker({ all, selected, toggle }: { all: PlatformOutlet[] | null; selected: Set<number>; toggle: (id: number) => void }) {
  if (!all) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[48px]" />)}</div>;
  if (all.length === 0) return <EmptyState icon={<StoreIcon size={22} />} title="Belum ada outlet" />;
  return (
    <div className="space-y-2 max-h-[46vh] overflow-y-auto">
      {all.map((o) => {
        const on = selected.has(o.id);
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
              <span className="font-bold text-ink">{o.name}</span> <span className="text-[12px] text-muted">{o.code}</span>
            </span>
            {!o.isActive && <Badge tone="warn">nonaktif</Badge>}
          </button>
        );
      })}
    </div>
  );
}

function CreateAssistantSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [canSell, setCanSell] = useState(false);
  const [all, setAll] = useState<PlatformOutlet[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(""); setUsername(""); setPassword(""); setCanSell(false); setSelected(new Set()); setErr(null);
      owner.assistants.outlets().then(setAll).catch(() => setAll([]));
    }
  }, [open]);

  function toggle(id: number) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Nama wajib diisi.");
    if (!/^[a-z0-9._]{3,20}$/.test(username.trim())) return setErr("Username 3-20 huruf kecil/angka/._");
    if (password.length < 6) return setErr("Password minimal 6 karakter.");
    setLoading(true);
    try {
      await owner.assistants.create({
        name: name.trim(),
        username: username.trim(),
        password,
        canSell,
        serverIds: [...selected],
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal membuat asisten.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Asisten baru">
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Rina" required />
        <TextField label="Username login" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="mis. rina" required />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Min 6 karakter." required />
        <label className="flex items-center justify-between rounded-2xl bg-white border border-line px-4 py-3">
          <span className="text-[14px] font-semibold text-ink">Boleh jual voucher <span className="text-muted font-normal">(belum aktif)</span></span>
          <Switch checked={canSell} onChange={setCanSell} />
        </label>
        <div>
          <div className="text-[13px] font-semibold text-ink mb-1.5">Akses outlet</div>
          <OutletPicker all={all} selected={selected} toggle={toggle} />
        </div>
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>Buat asisten ({selected.size} outlet)</Button>
      </form>
    </Sheet>
  );
}

function AccessSheet({ assistant, onClose, onSaved }: { assistant: Assistant | null; onClose: () => void; onSaved: () => void }) {
  const [all, setAll] = useState<PlatformOutlet[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!assistant) return;
    setErr(null);
    setSelected(new Set(assistant.outlets.map((o) => o.id)));
    owner.assistants.outlets().then(setAll).catch(() => setAll([]));
  }, [assistant]);

  function toggle(id: number) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  async function save() {
    if (!assistant) return;
    setErr(null); setLoading(true);
    try {
      await owner.assistants.assignOutlets(assistant.id, [...selected]);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan akses.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!assistant} onClose={onClose} title={assistant ? `Akses outlet · ${assistant.name}` : ""}>
      <div className="space-y-3.5">
        <p className="text-[12px] text-muted">Centang outlet yang boleh dilihat asisten ini. Hanya data outlet tercentang yang akan tampil untuknya.</p>
        <OutletPicker all={all} selected={selected} toggle={toggle} />
        {err && <Alert tone="error">{err}</Alert>}
        <Button fullWidth loading={loading} onClick={save}>Simpan ({selected.size} outlet)</Button>
      </div>
    </Sheet>
  );
}
