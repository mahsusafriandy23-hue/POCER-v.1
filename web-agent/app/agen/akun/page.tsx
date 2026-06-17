"use client";

import { useEffect, useState } from "react";
import { agent, type AgentProfile, type ServerStatus, ApiError } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, Skeleton } from "@/components/kit";
import { Button } from "@/components/ui";
import { LogoutIcon } from "@/components/icons";

// ─── Server status card ────────────────────────────────────────────────────

function ServerStatusCard({ s }: { s: ServerStatus }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-line last:border-0">
      {/* Status dot */}
      <div className="relative shrink-0">
        <div className={`h-2.5 w-2.5 rounded-full ${s.online ? "bg-emerald-400" : "bg-rose-500"}`} />
        {s.online && (
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink text-[14px] truncate">{s.name}</p>
        <p className="text-[11px] text-muted truncate">
          {s.online
            ? `Online · ${s.latencyMs}ms`
            : s.error ?? "Offline"}
        </p>
      </div>

      {/* Code badge */}
      <span className="font-mono text-[11px] font-bold text-dim bg-haze border border-line rounded-lg px-2 py-1 shrink-0">
        {s.code}
      </span>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AgentAccount() {
  const { session, logout } = useAuth();
  const [me, setMe]             = useState<AgentProfile | null>(null);
  const [servers, setServers]   = useState<ServerStatus[] | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    (async () => {
      try { setMe(await agent.me()); } catch {}
    })();
  }, []);

  async function refreshStatus() {
    setLoadingStatus(true);
    setServers(null);
    try { setServers(await agent.serverStatus()); }
    catch { setServers([]); }
    finally { setLoadingStatus(false); }
  }

  useEffect(() => { refreshStatus(); }, []);

  const initial = (session?.name ?? "A").charAt(0).toUpperCase();

  return (
    <div className="space-y-4">

      {/* Profile hero */}
      <div
        className="rounded-3xl p-5 relative overflow-hidden ring-1 ring-azure/20"
        style={{ background: "linear-gradient(135deg,#1C1700 0%,#2E2400 55%,#1C1700 100%)" }}
      >
        <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-azure/15 blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-2xl bg-azure/20 border-2 border-azure/40 grid place-items-center text-[26px] font-extrabold text-azure shrink-0">
            {initial}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-ink text-[18px] leading-tight truncate">
              {session?.name ?? "—"}
            </p>
            <p className="text-[12px] text-muted mt-0.5 truncate">
              {me?.username ? `@${me.username}` : ""}
              {me?.username && me?.phone ? " · " : ""}
              {me?.phone ?? ""}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="azure">Agen</Badge>
              {me && (
                me.status === "ACTIVE"
                  ? <Badge tone="success">Aktif</Badge>
                  : <Badge tone="danger">Nonaktif</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Server connection status */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[12px] font-bold text-muted uppercase tracking-widest">Status Koneksi Server</p>
          <button
            onClick={refreshStatus}
            disabled={loadingStatus}
            className="text-[11px] font-semibold text-azure disabled:opacity-50"
          >
            {loadingStatus ? "Memeriksa…" : "↻ Refresh"}
          </button>
        </div>

        {servers === null ? (
          <div className="space-y-3 mt-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 bg-haze rounded-xl" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <p className="text-[13px] text-muted mt-2">Tidak ada server tersedia.</p>
        ) : (
          <div className="mt-1">
            {servers.map((s) => <ServerStatusCard key={s.id} s={s} />)}
          </div>
        )}
      </Card>

      {/* Logout */}
      <Button
        variant="soft"
        fullWidth
        onClick={logout}
        className="!text-rose-400 !bg-rose-950/40 border border-rose-900/50"
      >
        <LogoutIcon size={18} /> Keluar
      </Button>

      <p className="text-center text-[11px] text-dim">POCER · by penanggak.net</p>
    </div>
  );
}
