"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError, auth as authApi, type Provider } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import { Button, TextField, Alert } from "@/components/ui";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

export default function DaftarPage() {
  const { register, user, ready } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<number | "">("");

  useEffect(() => {
    if (ready && user) router.replace("/beranda");
  }, [ready, user, router]);

  useEffect(() => {
    authApi
      .providers()
      .then((list) => {
        setProviders(list);
        if (list.length === 1) setProviderId(list[0].id); // auto-pick the only provider
      })
      .catch(() => setProviders([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[a-zA-Z0-9._]{3,20}$/.test(username.trim())) {
      setError("Username 3–20 karakter (huruf, angka, titik, underscore).");
      return;
    }
    if (providerId === "") {
      setError("Pilih Penyedia Layanan dulu.");
      return;
    }
    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      return;
    }
    setBusy(true);
    try {
      await register({
        name: name.trim() || undefined,
        username: username.trim(),
        phone: phone.trim(),
        password,
        providerId: Number(providerId),
      });
      router.replace("/beranda");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mendaftar. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Daftar" subtitle="Buat akun POCER, beli voucher lebih mudah.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <div>
            <label className="block text-[14px] font-semibold text-ink mb-1.5">Penyedia Layanan</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value === "" ? "" : Number(e.target.value))}
              required
              className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 text-[15px] text-ink outline-none focus:border-azure focus:ring-2 focus:ring-azure/20 transition-all"
            >
              <option value="" disabled>
                Pilih penyedia…
              </option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[13px] text-muted">Pilih jaringan/penyedia tempat kamu beli voucher & isi saldo.</p>
        </div>

        <TextField
          label="Nama"
          type="text"
          autoComplete="name"
          placeholder="Nama kamu"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <TextField
          label="Username"
          type="text"
          autoComplete="username"
          placeholder="cth: budi_wifi"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          hint="Dipakai untuk masuk. Huruf kecil, angka, titik, underscore."
        />

        <TextField
          label="Nomor WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="08xxxxxxxxxx"
          prefix="+62"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          hint="Voucher dan info akun dikirim ke nomor ini."
        />

        <TextField
          label="Kata sandi"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Buat kata sandi"
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
          Daftar
        </Button>
      </form>

      <p className="mt-5 text-center text-[14px] text-muted">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-bold text-azure">
          Masuk
        </Link>
      </p>
    </AuthShell>
  );
}
