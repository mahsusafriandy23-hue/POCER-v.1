"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { owner, type AgentDetail, type OwnerOutlet, ApiError } from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Money, Badge, Switch, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { ArrowLeftIcon, CheckIcon } from "@/components/icons";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [outlets, setOutlets] = useState<OwnerOutlet[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingOutlets, setSavingOutlets] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  async function reload() {
    try {
      const [a, o] = await Promise.all([owner.agents.get(id), owner.outlets()]);
      setAgent(a);
      setOutlets(o);
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

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-muted text-[14px] font-semibold mb-4">
        <ArrowLeftIcon size={18} /> Kembali
      </button>

      <PageTitle
        title={agent.name}
        subtitle={agent.username ? `@${agent.username} · ${agent.phone}` : agent.phone}
      />

      {err && <Alert tone="error">{err}</Alert>}
      {msg && <div className="mb-3"><Alert tone="success">{msg}</Alert></div>}

      {/* Saldo + status */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[12px] font-semibold text-muted">Saldo dompet</div>
          <div className="text-[20px] font-extrabold text-ink mt-0.5">
            <Money value={agent.balance} />
          </div>
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

      {/* Outlet assignment */}
      <div className="mt-6">
        <h2 className="text-[15px] font-extrabold text-ink mb-1">Outlet yang boleh dijual</h2>
        <p className="text-[13px] text-muted mb-3">Pilih dari outlet milik Anda. Agen hanya bisa menjual paket outlet terpilih.</p>
        {outlets.length === 0 ? (
          <Card><div className="p-4 text-[13px] text-muted">Anda belum punya outlet.</div></Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {outlets.map((o) => {
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
    </div>
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
