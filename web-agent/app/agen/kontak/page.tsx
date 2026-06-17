"use client";

import { useEffect, useState } from "react";
import { agent, type AgentContact, ApiError } from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { UserIcon, PlusIcon, TrashIcon, EditIcon } from "@/components/icons";

export default function KontakPage() {
  const [contacts, setContacts] = useState<AgentContact[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgentContact | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setContacts(await agent.contacts.list());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat kontak.");
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    if (!confirm("Hapus kontak ini?")) return;
    try {
      await agent.contacts.delete(id);
      setContacts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageTitle title="Kontak Pelanggan" subtitle="Simpan username pelanggan untuk akses cepat saat jual." />
        <Button className="shrink-0 !py-2.5 !px-4" onClick={() => setCreating(true)}>+ Tambah</Button>
      </div>

      {err && <Alert tone="error">{err}</Alert>}

      {contacts === null ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : contacts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserIcon size={24} />}
            title="Belum ada kontak"
            hint="Tambah username atau nomor pelanggan untuk pilih cepat saat berjualan."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {contacts.map((c) => (
            <Card key={c.id} className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-azure/10 grid place-items-center shrink-0">
                <UserIcon size={18} className="text-azure" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink truncate">{c.name}</p>
                <p className="text-[12px] text-muted truncate">
                  {c.username ? `@${c.username}` : ""}{c.username && c.phone ? " · " : ""}{c.phone ?? ""}
                  {c.note ? <span className="ml-1 italic text-dim">{c.note}</span> : null}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setEditing(c)}
                  className="p-2 rounded-xl text-muted hover:bg-haze hover:text-azure transition-colors"
                >
                  <EditIcon size={16} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-2 rounded-xl text-muted hover:bg-rose-50 hover:text-rose-600 transition-colors"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContactSheet
        open={creating || !!editing}
        initial={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function ContactSheet({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: AgentContact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setUsername(initial?.username ?? "");
      setPhone(initial?.phone ?? "");
      setNote(initial?.note ?? "");
      setErr(null);
    }
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Nama wajib diisi."); return; }
    setErr(null);
    setLoading(true);
    try {
      const body = { name: name.trim(), username: username.trim() || undefined, phone: phone.trim() || undefined, note: note.trim() || undefined };
      if (initial) await agent.contacts.update(initial.id, body);
      else await agent.contacts.create(body);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={initial ? `Edit · ${initial.name}` : "Tambah kontak"}>
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Pak Budi" required />
        <TextField
          label="Username akun (opsional)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="mis. budivoucher"
          hint="Username yang dipakai pelanggan saat daftar di storefront."
        />
        <TextField
          label="No. HP / WhatsApp (opsional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="0812xxxxxxx"
        />
        <TextField
          label="Catatan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="mis. Warung sebelah pasar"
        />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>Simpan</Button>
      </form>
    </Sheet>
  );
}
