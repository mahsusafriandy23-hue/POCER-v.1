"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { initial } from "@/lib/format";
import { customer, auth as authApi, ApiError, type Provider, type CustomerProfile } from "@/lib/api";

function ProviderCard() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    customer.me().then((p) => {
      setProfile(p);
      setChoice(p.provider?.id ?? "");
    }).catch(() => {});
    authApi.providers().then(setProviders).catch(() => {});
  }, []);

  async function save() {
    if (choice === "") return;
    setBusy(true);
    setMsg(null);
    try {
      const updated = await customer.setProvider(Number(choice));
      setProfile(updated);
      setEditing(false);
      setMsg("Penyedia Layanan diperbarui.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-muted">Penyedia Layanan</div>
          <div className="text-[15px] font-bold text-ink truncate">
            {profile?.provider?.name ?? "Belum dipilih"}
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-[13px] font-bold text-azure shrink-0">
            Ubah
          </button>
        )}
      </div>
      {editing && (
        <div className="space-y-2.5">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-azure focus:ring-2 focus:ring-azure/20"
          >
            <option value="" disabled>Pilih penyedia…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button fullWidth loading={busy} onClick={save} disabled={choice === ""}>Simpan</Button>
            <Button variant="soft" onClick={() => { setEditing(false); setChoice(profile?.provider?.id ?? ""); }}>Batal</Button>
          </div>
        </div>
      )}
      {msg && <p className="text-[12px] text-muted">{msg}</p>}
    </div>
  );
}

function Inner() {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader title="Akun" />

      <div className="flex-1 px-5 py-5 space-y-4">
        <div className="rounded-4xl bg-white p-5 shadow-soft flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-hero text-white grid place-items-center font-extrabold text-xl">
            {initial(user?.name, user?.phone)}
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-ink truncate">{user?.name || "Pelanggan POCER"}</div>
            <div className="text-[13px] text-muted">+{user?.phone}</div>
            {user?.username && (
              <div className="text-[11px] font-semibold text-azure bg-haze px-2 py-0.5 rounded-full inline-block mt-1">
                @{user.username}
              </div>
            )}
          </div>
        </div>

        <ProviderCard />

        <div className="rounded-2xl bg-white shadow-soft divide-y divide-line">
          {[
            { label: "Bantuan & WhatsApp", href: "#" },
            { label: "Tentang POCER", href: "#" },
            { label: "Kebijakan privasi", href: "#" },
          ].map((row) => (
            <a key={row.label} href={row.href} className="flex items-center justify-between px-4 py-3.5">
              <span className="text-[14px] font-medium text-ink">{row.label}</span>
              <span className="text-dim">›</span>
            </a>
          ))}
        </div>

        <Button variant="soft" fullWidth onClick={logout}>
          Keluar
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}

export default function AkunPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
