"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { ApiError, type Role } from "@/lib/api";
import { APP_MODE, FIXED_ROLE } from "@/lib/config";
import { Button, TextField, Alert } from "@/components/ui";
import { StoreIcon, UserIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

export default function MasukPage() {
  const { ready, session, loginOwner, loginAgent } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<Role>(FIXED_ROLE ?? "agent");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace(session.role === "owner" ? "/owner" : "/agen");
  }, [ready, session, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("expired")) {
      setExpired(true);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (role === "owner") await loginOwner(login.trim(), password);
      else await loginAgent(login.trim(), password);
      router.replace(role === "owner" ? "/owner" : "/agen");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal masuk. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-white flex flex-col">
      {/* Brand header */}
      <div className="px-6 pt-14 pb-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-hero opacity-20" />
        <div className="relative">
          <div className="h-12 w-12 rounded-2xl bg-hero grid place-items-center font-extrabold text-xl shadow-qa">P</div>
          <h1 className="mt-5 text-[26px] font-extrabold leading-tight">
            POCER {APP_MODE === "agent" ? "Agen" : APP_MODE === "owner" ? "Admin" : "Console"}
          </h1>
          <p className="text-white/60 text-[14px] mt-1">
            {APP_MODE === "agent"
              ? "Masuk untuk menjual voucher."
              : APP_MODE === "owner"
                ? "Konsol pemilik — area terbatas."
                : "Kelola outlet, agen, dan penjualan voucher."}
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 bg-stage text-ink rounded-t-[2rem] px-6 pt-7 pb-10">
        <div className="max-w-sm mx-auto">
          {/* Role toggle — only when this deployment exposes both surfaces */}
          {APP_MODE === "both" && (
            <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-white border border-line mb-6">
              {(
                [
                  { key: "owner", label: "Pemilik", icon: StoreIcon },
                  { key: "agent", label: "Agen", icon: UserIcon },
                ] as const
              ).map((r) => {
                const active = role === r.key;
                const Icon = r.icon;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      setRole(r.key);
                      setErr(null);
                    }}
                    className={`relative flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-bold transition-colors ${
                      active ? "text-white" : "text-muted"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="role-pill"
                        className="absolute inset-0 rounded-xl bg-azure"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      <Icon size={18} /> {r.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <TextField
              label={role === "owner" ? "Username atau No. WhatsApp" : "Username atau No. WhatsApp"}
              placeholder={role === "owner" ? "budi" : "sari"}
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
            <TextField
              label="Kata sandi"
              type={show ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              suffix={
                <button type="button" onClick={() => setShow((s) => !s)} className="text-muted p-1" tabIndex={-1}>
                  {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              }
            />
            {expired && !err && <Alert tone="info">Sesi Anda berakhir. Silakan masuk lagi.</Alert>}
            {err && <Alert tone="error">{err}</Alert>}
            <Button type="submit" fullWidth loading={loading}>
              Masuk sebagai {role === "owner" ? "Pemilik" : "Agen"}
            </Button>
          </form>

          <p className="text-center text-[12px] text-muted mt-6">
            Akun dibuat oleh {role === "owner" ? "operator platform" : "pemilik Anda"}.
          </p>
        </div>
      </div>
    </div>
  );
}
