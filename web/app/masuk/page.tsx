"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import { Button, TextField, Alert } from "@/components/ui";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

export default function MasukPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in → straight to home.
  useEffect(() => {
    if (ready && user) router.replace("/beranda");
  }, [ready, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(phone.trim(), password);
      router.replace("/beranda");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Masuk" subtitle="Selamat datang kembali di POCER 👋">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <TextField
          label="Username atau No. WhatsApp"
          type="text"
          autoComplete="username"
          placeholder="username atau 08xxxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />

        <TextField
          label="Kata sandi"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Masukkan kata sandi"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          suffix={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="text-dim hover:text-azure shrink-0"
              aria-label={show ? "Sembunyikan sandi" : "Tampilkan sandi"}
            >
              {show ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
            </button>
          }
        />

        <Button type="submit" fullWidth loading={busy}>
          Masuk
        </Button>
      </form>

      <p className="mt-5 text-center text-[14px] text-muted">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-bold text-azure">
          Daftar
        </Link>
      </p>
    </AuthShell>
  );
}
