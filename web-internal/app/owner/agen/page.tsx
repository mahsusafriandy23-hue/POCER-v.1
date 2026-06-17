"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { owner, type AgentRow, type OwnerOutlet, ApiError } from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Money, Badge, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { UsersIcon, PlusIcon, ChevronRightIcon } from "@/components/icons";

export default function OwnerAgents() {
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [outlets, setOutlets] = useState<OwnerOutlet[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function reload() {
    try {
      const [a, o] = await Promise.all([owner.agents.list(), owner.outlets()]);
      setAgents(a);
      setOutlets(o);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat agen.");
    }
  }
  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <PageTitle
        title="Agen"
        subtitle="Reseller yang menjual voucher untuk outlet Anda."
        action={
          <Button onClick={() => setOpen(true)} className="!py-2.5 !px-4">
            <PlusIcon size={18} /> Agen
          </Button>
        }
      />

      {err && <Alert tone="error">{err}</Alert>}

      <div className="space-y-2.5">
        {!agents ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        ) : agents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<UsersIcon size={24} />}
              title="Belum ada agen"
              hint="Tambah agen pertama Anda dan tentukan outlet yang boleh ia jual."
            />
          </Card>
        ) : (
          agents.map((a) => (
            <Link key={a.id} href={`/owner/agen/${a.id}`}>
              <Card className="p-4 flex items-center gap-3 hover:border-azure/40 transition-colors">
                <div className="h-11 w-11 rounded-2xl bg-haze text-azure grid place-items-center font-extrabold">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink truncate">{a.name}</span>
                    {a.status !== "ACTIVE" && <Badge tone="danger">nonaktif</Badge>}
                  </div>
                  <div className="text-[12px] text-muted truncate">
                    {a.username ? `@${a.username} · ` : ""}
                    {a.outlets.length ? a.outlets.map((o) => o.code).join(", ") : "belum ada outlet"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-muted">saldo</div>
                  <div className="font-extrabold text-ink text-[14px]">
                    <Money value={a.balance} />
                  </div>
                </div>
                <ChevronRightIcon size={18} className="text-dim" />
              </Card>
            </Link>
          ))
        )}
      </div>

      <CreateAgentSheet
        open={open}
        outlets={outlets}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          setAgents(null);
          reload();
        }}
      />
    </div>
  );
}

function CreateAgentSheet({
  open,
  outlets,
  onClose,
  onCreated,
}: {
  open: boolean;
  outlets: OwnerOutlet[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: number) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await owner.agents.create({
        name: name.trim(),
        phone: phone.trim(),
        username: username.trim() || undefined,
        password,
        pin: pin.trim() || undefined,
        serverIds: picked,
      });
      // reset
      setName("");
      setPhone("");
      setUsername("");
      setPassword("");
      setPin("");
      setPicked([]);
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal membuat agen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Tambah agen">
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nama agen" />
        <TextField
          label="No. WhatsApp"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          inputMode="tel"
          placeholder="0812xxxxxxx"
        />
        <TextField
          label="Username (opsional)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="huruf kecil, angka, . _"
        />
        <TextField
          label="Kata sandi"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          hint="Minimal 6 karakter."
        />
        <TextField
          label="PIN transaksi (opsional)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          placeholder="diminta saat menjual"
        />

        <div>
          <span className="block text-[13px] font-semibold text-ink mb-2">Outlet yang boleh dijual</span>
          {outlets.length === 0 ? (
            <p className="text-[13px] text-muted">Anda belum punya outlet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {outlets.map((o) => {
                const on = picked.includes(o.id);
                return (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => toggle(o.id)}
                    className={`rounded-xl px-3 py-2 text-[13px] font-bold border transition-colors ${
                      on ? "bg-azure text-white border-azure" : "bg-white text-muted border-line"
                    }`}
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Simpan agen
        </Button>
      </form>
    </Sheet>
  );
}
