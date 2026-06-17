"use client";

import { useEffect, useState } from "react";
import { agent, type AgentPkg, type Outlet, type AgentProfile, type SellResult, ApiError } from "@/lib/api";
import { rupiah, humanDuration, formatExpiry } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import { StoreIcon, BoltIcon, CheckIcon, CopyIcon, UserIcon, ChatIcon } from "@/components/icons";

type Mode = "account" | "whatsapp";

export default function SellPage() {
  const [me, setMe] = useState<AgentProfile | null>(null);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [packages, setPackages] = useState<AgentPkg[] | null>(null);
  const [pkg, setPkg] = useState<AgentPkg | null>(null);
  const [mode, setMode] = useState<Mode>("account");
  const [customerId, setCustomerId] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SellResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await agent.me();
        setMe(profile);
        if (profile.outlets.length === 1) selectOutlet(profile.outlets[0]);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Gagal memuat data.");
      }
    })();
  }, []);

  async function selectOutlet(o: Outlet) {
    setOutlet(o);
    setPkg(null);
    setPackages(null);
    try {
      setPackages(await agent.packages(o.id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat paket.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pkg) return;
    setErr(null);
    if (mode === "account" && !customerId.trim()) {
      setErr("Masukkan ID akun pelanggan.");
      return;
    }
    if (mode === "whatsapp" && !whatsapp.trim()) {
      setErr("Masukkan nomor WhatsApp.");
      return;
    }
    setLoading(true);
    try {
      const res =
        mode === "account"
          ? await agent.sellToCustomer({
              customerId: Number(customerId.trim()),
              packageId: pkg.id,
              pin: pin.trim() || undefined,
            })
          : await agent.sellToWhatsapp({
              customerWhatsapp: whatsapp.trim(),
              packageId: pkg.id,
              pin: pin.trim() || undefined,
            });
      setResult(res);
      if (res.agentBalance && me) setMe({ ...me, balance: res.agentBalance.balance });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menjual voucher.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setPkg(null);
    setCustomerId("");
    setWhatsapp("");
    setPin("");
    setErr(null);
  }

  // ── Success screen ──
  if (result) {
    return <SellSuccess result={result} pkg={pkg} onAgain={reset} balance={me?.balance ?? null} />;
  }

  return (
    <div>
      <PageTitle title="Jual voucher" subtitle="Pilih outlet, paket, lalu kirim ke pelanggan." />

      {err && <Alert tone="error">{err}</Alert>}

      {/* Step 1: outlet */}
      <h2 className="text-[14px] font-extrabold text-ink mb-2 mt-1">1. Outlet</h2>
      {!me ? (
        <Skeleton className="h-12" />
      ) : me.outlets.length === 0 ? (
        <Card>
          <EmptyState icon={<StoreIcon size={24} />} title="Belum ada outlet" hint="Hubungi pemilik untuk ditetapkan outlet." />
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {me.outlets.map((o) => (
            <button
              key={o.id}
              onClick={() => selectOutlet(o)}
              className={`rounded-xl px-4 py-2.5 text-[14px] font-bold border transition-colors flex items-center gap-1.5 ${
                outlet?.id === o.id ? "bg-azure text-white border-azure" : "bg-white text-muted border-line"
              }`}
            >
              <StoreIcon size={16} /> {o.name}
            </button>
          ))}
        </div>
      )}

      {/* Step 2: package */}
      {outlet && (
        <>
          <h2 className="text-[14px] font-extrabold text-ink mb-2 mt-6">2. Paket</h2>
          {!packages ? (
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <Card>
              <EmptyState icon={<BoltIcon size={24} />} title="Belum ada paket aktif" />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {packages.map((p) => (
                <button key={p.id} onClick={() => setPkg(p)} className="w-full text-left">
                  <Card
                    className={`p-4 flex items-center gap-3 transition-colors ${
                      pkg?.id === p.id ? "border-azure ring-2 ring-azure/20" : "hover:border-azure/40"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{p.name}</span>
                        <Badge tone="neutral">{humanDuration(p.duration)}</Badge>
                      </div>
                      <div className="text-[12px] text-muted mt-0.5">Harga agen</div>
                    </div>
                    <div className="font-extrabold text-ink">
                      <span className="opacity-60 text-[13px]">Rp</span> {rupiah(p.agentPrice)}
                    </div>
                    {pkg?.id === p.id && <CheckIcon size={20} className="text-azure" strokeWidth={3} />}
                  </Card>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Step 3: deliver */}
      {pkg && (
        <form onSubmit={submit} className="mt-6">
          <h2 className="text-[14px] font-extrabold text-ink mb-2">3. Kirim ke</h2>
          <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-white border border-line mb-4">
            {(
              [
                { key: "account", label: "Akun pelanggan", icon: UserIcon },
                { key: "whatsapp", label: "WhatsApp", icon: ChatIcon },
              ] as const
            ).map((m) => {
              const active = mode === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${
                    active ? "bg-azure text-white" : "text-muted"
                  }`}
                >
                  <Icon size={17} /> {m.label}
                </button>
              );
            })}
          </div>

          {mode === "account" ? (
            <TextField
              label="ID akun pelanggan"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              inputMode="numeric"
              placeholder="mis. 1024"
              hint="Voucher langsung masuk ke inbox aplikasi pelanggan."
            />
          ) : (
            <TextField
              label="No. WhatsApp pelanggan"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              placeholder="0812xxxxxxx"
              hint="Voucher dikirim sebagai pesan (offline)."
            />
          )}

          {me?.hasPin && (
            <div className="mt-3.5">
              <TextField
                label="PIN transaksi"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                type="password"
                placeholder="••••"
              />
            </div>
          )}

          <Card className="mt-4 p-4 flex items-center justify-between bg-haze border-0">
            <span className="text-[14px] font-semibold text-ink">Dipotong dari saldo</span>
            <span className="font-extrabold text-ink text-[18px]">
              <span className="opacity-60 text-[13px]">Rp</span> {rupiah(pkg.agentPrice)}
            </span>
          </Card>

          {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}

          <Button type="submit" fullWidth loading={loading} className="mt-4">
            <BoltIcon size={18} /> Jual sekarang
          </Button>
        </form>
      )}
    </div>
  );
}

function SellSuccess({
  result,
  pkg,
  onAgain,
  balance,
}: {
  result: SellResult;
  pkg: AgentPkg | null;
  onAgain: () => void;
  balance: number | null;
}) {
  const v = result.voucher;
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="pt-2">
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
          <CheckIcon size={32} strokeWidth={2.6} />
        </div>
        <h1 className="mt-4 text-[20px] font-extrabold text-ink">Voucher terjual!</h1>
        <p className="text-[13px] text-muted mt-1">
          {result.deliveredTo ? "Terkirim ke akun pelanggan." : "Siap dikirim ke pelanggan."}
        </p>
      </div>

      {v ? (
        <Card className="overflow-hidden">
          <div className="bg-inbox text-white p-5">
            <div className="text-white/60 text-[12px] font-semibold">{pkg?.name ?? v.profile}</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => copy(v.username, "u")} className="text-left">
                <div className="text-white/50 text-[11px]">Username</div>
                <div className="font-extrabold text-[18px] flex items-center gap-1.5">
                  {v.username} {copied === "u" ? <CheckIcon size={15} /> : <CopyIcon size={15} className="opacity-60" />}
                </div>
              </button>
              <button onClick={() => copy(v.password, "p")} className="text-left">
                <div className="text-white/50 text-[11px]">Password</div>
                <div className="font-extrabold text-[18px] flex items-center gap-1.5">
                  {v.password} {copied === "p" ? <CheckIcon size={15} /> : <CopyIcon size={15} className="opacity-60" />}
                </div>
              </button>
            </div>
          </div>
          <div className="p-4 text-[12px] text-muted flex items-center justify-between">
            <span>Ref: {result.reference.slice(0, 18)}…</span>
            {v.expiryDate && <span>Berlaku s/d {formatExpiry(v.expiryDate)}</span>}
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <Alert tone="info">Transaksi berhasil. Ref: {result.reference}</Alert>
        </Card>
      )}

      {balance != null && (
        <p className="text-center text-[13px] text-muted mt-4">
          Saldo sekarang: <span className="font-bold text-ink">Rp{rupiah(balance)}</span>
        </p>
      )}

      <Button fullWidth onClick={onAgain} className="mt-5">
        Jual lagi
      </Button>
    </div>
  );
}
