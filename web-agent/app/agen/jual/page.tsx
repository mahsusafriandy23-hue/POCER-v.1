"use client";

import { useEffect, useRef, useState } from "react";
import { agent, type AgentPkg, type Outlet, type AgentProfile, type SellResult, type AgentContact, ApiError } from "@/lib/api";
import { rupiah, humanDuration, formatExpiry } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { StoreIcon, BoltIcon, CheckIcon, CopyIcon, UserIcon, ChatIcon, PlusIcon, MinusIcon, ShoppingCartIcon } from "@/components/icons";

type Mode = "account" | "whatsapp";
type CartItem = { pkg: AgentPkg; qty: number };

export default function SellPage() {
  const [me, setMe] = useState<AgentProfile | null>(null);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [packages, setPackages] = useState<AgentPkg[] | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mode, setMode] = useState<Mode>("account");
  const [customerId, setCustomerId] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<SellResult[] | null>(null);
  const [contacts, setContacts] = useState<AgentContact[]>([]);
  const [showContactPicker, setShowContactPicker] = useState(false);

  const [detect, setDetect] = useState<
    { state: "idle" | "checking" | "found" | "missing"; name?: string | null; username?: string | null; phone?: string }
  >({ state: "idle" });

  // Debounced lookup
  useEffect(() => {
    if (mode !== "account") return;
    const handle = customerId.trim();
    if (handle.length < 3) { setDetect({ state: "idle" }); return; }
    let alive = true;
    setDetect({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const r = await agent.lookupCustomer(handle);
        if (!alive) return;
        setDetect(r.found ? { state: "found", name: r.name, username: r.username, phone: r.phone } : { state: "missing" });
      } catch { if (alive) setDetect({ state: "idle" }); }
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [customerId, mode]);

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
    agent.contacts.list().then(setContacts).catch(() => {});
  }, []);

  async function selectOutlet(o: Outlet) {
    setOutlet(o);
    setCart([]);
    setPackages(null);
    try { setPackages(await agent.packages(o.id)); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Gagal memuat paket."); }
  }

  function setQty(pkg: AgentPkg, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.pkg.id !== pkg.id));
    } else {
      setCart((prev) => {
        const idx = prev.findIndex((i) => i.pkg.id === pkg.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = { pkg, qty }; return next; }
        return [...prev, { pkg, qty }];
      });
    }
  }

  function qtyOf(pkg: AgentPkg) {
    return cart.find((i) => i.pkg.id === pkg.id)?.qty ?? 0;
  }

  const totalAgent = cart.reduce((s, i) => s + i.pkg.agentPrice * i.qty, 0);
  const totalSell  = cart.reduce((s, i) => s + i.pkg.sellPrice * i.qty, 0);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length) { setErr("Pilih minimal satu paket."); return; }
    setErr(null);
    if (mode === "account" && !customerId.trim()) { setErr("Masukkan username atau No. HP pelanggan."); return; }
    if (mode === "account" && detect.state === "missing") { setErr("Pelanggan tidak ditemukan."); return; }
    if (mode === "whatsapp" && !whatsapp.trim()) { setErr("Masukkan nomor WhatsApp."); return; }
    setLoading(true);
    try {
      const res = await agent.sellBatch({
        items: cart.map((i) => ({ packageId: i.pkg.id, qty: i.qty })),
        ...(mode === "account" ? { username: customerId.trim() } : { customerWhatsapp: whatsapp.trim() }),
        pin: pin.trim() || undefined,
      });
      setResults(res.results);
      if (res.results[0]?.agentBalance && me) setMe({ ...me, balance: res.results[0].agentBalance.balance });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menjual voucher.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResults(null);
    setCart([]);
    setCustomerId("");
    setWhatsapp("");
    setPin("");
    setErr(null);
    setDetect({ state: "idle" });
  }

  if (results) {
    return <BatchSuccess results={results} cart={cart} onAgain={reset} balance={me?.balance ?? null} />;
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
        <Card><EmptyState icon={<StoreIcon size={24} />} title="Belum ada outlet" hint="Hubungi pemilik." /></Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {me.outlets.map((o) => (
            <button key={o.id} onClick={() => selectOutlet(o)}
              className={`rounded-xl px-4 py-2.5 text-[14px] font-bold border transition-colors flex items-center gap-1.5 ${
                outlet?.id === o.id ? "bg-azure text-[#0A0A0F] border-azure" : "bg-surface text-muted border-line hover:border-azure/40"
              }`}>
              <StoreIcon size={16} /> {o.name}
            </button>
          ))}
        </div>
      )}

      {/* Step 2: packages with qty */}
      {outlet && (
        <>
          <div className="flex items-center justify-between mt-6 mb-2">
            <h2 className="text-[14px] font-extrabold text-ink">2. Paket</h2>
            {totalItems > 0 && (
              <span className="text-[12px] font-semibold text-azure flex items-center gap-1">
                <ShoppingCartIcon size={14} /> {totalItems} item dipilih
              </span>
            )}
          </div>
          {!packages ? (
            <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : packages.length === 0 ? (
            <Card><EmptyState icon={<BoltIcon size={24} />} title="Belum ada paket aktif" /></Card>
          ) : (
            <div className="space-y-2.5">
              {packages.map((p) => {
                const qty = qtyOf(p);
                return (
                  <Card key={p.id} className={`p-4 flex items-center gap-3 transition-colors ${qty > 0 ? "border-azure ring-2 ring-azure/20" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{p.name}</span>
                        <Badge tone="neutral">{humanDuration(p.duration)}</Badge>
                      </div>
                      <div className="text-[12px] text-muted mt-0.5">
                        Modal Rp{rupiah(p.agentPrice)} · untung{" "}
                        <span className="text-emerald-600 font-semibold">Rp{rupiah(p.margin)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 mr-2">
                      <div className="text-[10px] text-dim font-semibold uppercase tracking-wide">Harga jual</div>
                      <div className="font-extrabold text-ink">
                        <span className="opacity-60 text-[13px]">Rp</span> {rupiah(p.sellPrice)}
                      </div>
                    </div>
                    {/* Qty stepper */}
                    <div className="flex items-center gap-1 shrink-0">
                      {qty > 0 ? (
                        <>
                          <button onClick={() => setQty(p, qty - 1)}
                            className="h-8 w-8 rounded-xl border border-line bg-white text-ink flex items-center justify-center hover:bg-haze transition-colors">
                            <MinusIcon size={14} />
                          </button>
                          <span className="w-6 text-center font-extrabold text-azure text-[15px]">{qty}</span>
                          <button onClick={() => setQty(p, qty + 1)}
                            className="h-8 w-8 rounded-xl bg-azure text-white flex items-center justify-center hover:bg-azure/90 transition-colors">
                            <PlusIcon size={14} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setQty(p, 1)}
                          className="h-8 w-8 rounded-xl bg-azure text-white flex items-center justify-center hover:bg-azure/90 transition-colors">
                          <PlusIcon size={14} />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Step 3: deliver */}
      {cart.length > 0 && (
        <form onSubmit={submit} className="mt-6">
          <h2 className="text-[14px] font-extrabold text-ink mb-2">3. Kirim ke</h2>
          <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-white border border-line mb-4">
            {([
              { key: "account", label: "Akun pelanggan", icon: UserIcon },
              { key: "whatsapp", label: "WhatsApp", icon: ChatIcon },
            ] as const).map((m) => {
              const active = mode === m.key;
              const Icon = m.icon;
              return (
                <button key={m.key} type="button" onClick={() => setMode(m.key)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${active ? "bg-azure text-white" : "text-muted"}`}>
                  <Icon size={17} /> {m.label}
                </button>
              );
            })}
          </div>

          {mode === "account" ? (
            <div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextField
                    label="Username atau No. HP pelanggan"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    placeholder="mis. budi atau 0812xxxxxxx"
                    hint="Voucher langsung masuk ke inbox akun pelanggan."
                  />
                </div>
                {contacts.length > 0 && (
                  <div className="pt-[26px]">
                    <button type="button" onClick={() => setShowContactPicker(true)}
                      className="h-[44px] px-3 rounded-xl border border-line bg-white text-azure font-bold text-[13px] hover:bg-haze transition-colors whitespace-nowrap">
                      Kontak
                    </button>
                  </div>
                )}
              </div>
              {detect.state === "checking" && <div className="mt-1.5 text-[12px] text-muted">Mencari pelanggan…</div>}
              {detect.state === "found" && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600">
                  <CheckIcon size={14} strokeWidth={3} />
                  Terdeteksi: {detect.name || detect.username || "pelanggan"}
                  {detect.phone ? <span className="text-muted font-normal">· {detect.phone}</span> : null}
                </div>
              )}
              {detect.state === "missing" && (
                <div className="mt-1.5 text-[12px] font-semibold text-rose-600">
                  Pelanggan tidak ditemukan.
                </div>
              )}
            </div>
          ) : (
            <TextField label="No. WhatsApp pelanggan" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel" placeholder="0812xxxxxxx" hint="Voucher dikirim sebagai pesan (offline)." />
          )}

          {me?.hasPin && (
            <div className="mt-3.5">
              <TextField label="PIN transaksi" value={pin} onChange={(e) => setPin(e.target.value)}
                inputMode="numeric" type="password" placeholder="••••" />
            </div>
          )}

          {/* Cart summary */}
          <Card className="mt-4 p-4 bg-haze border-0 space-y-2">
            {cart.map((item) => (
              <div key={item.pkg.id} className="flex items-center justify-between text-[13px]">
                <span className="text-muted">{item.pkg.name} × {item.qty}</span>
                <span className="font-semibold text-ink">Rp{rupiah(item.pkg.agentPrice * item.qty)}</span>
              </div>
            ))}
            <div className="border-t border-azure/10 pt-2 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink">Total dipotong saldo</span>
              <span className="font-extrabold text-ink text-[18px]">
                <span className="opacity-60 text-[13px]">Rp</span> {rupiah(totalAgent)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">Total ke pelanggan</span>
              <span className="font-bold text-ink">Rp{rupiah(totalSell)}</span>
            </div>
          </Card>

          {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}
          <Button type="submit" fullWidth loading={loading} className="mt-4">
            <BoltIcon size={18} /> Jual {totalItems} voucher
          </Button>
        </form>
      )}

      {/* Contact picker — pakai Sheet agar terkunci di kolom 440px */}
      <Sheet open={showContactPicker} onClose={() => setShowContactPicker(false)} title="Pilih kontak">
        <div className="divide-y divide-line -mx-5">
          {contacts.map((c) => (
            <button key={c.id} className="w-full text-left px-5 py-3.5 hover:bg-haze/60 transition-colors flex items-center gap-3"
              onClick={() => {
                setCustomerId(c.username || c.phone || "");
                setShowContactPicker(false);
              }}>
              <div className="h-9 w-9 rounded-full bg-azure/10 grid place-items-center shrink-0">
                <UserIcon size={16} className="text-azure" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-ink text-[14px]">{c.name}</p>
                <p className="text-[12px] text-muted truncate">
                  {c.username ? `@${c.username}` : c.phone ?? ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function BatchSuccess({
  results, cart, onAgain, balance,
}: {
  results: SellResult[];
  cart: CartItem[];
  onAgain: () => void;
  balance: number | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  // Expand cart items by qty to get the package name for each result in order.
  const flatNames = cart.flatMap((item) => Array(item.qty).fill(item.pkg.name));

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); });
  }
  return (
    <div className="pt-2">
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
          <CheckIcon size={32} strokeWidth={2.6} />
        </div>
        <h1 className="mt-4 text-[20px] font-extrabold text-ink">{results.length} voucher terjual!</h1>
        <p className="text-[13px] text-muted mt-1">
          {results[0]?.deliveredTo ? "Terkirim ke akun pelanggan." : "Siap dikirim ke pelanggan."}
        </p>
      </div>

      <div className="space-y-3">
        {results.map((result, idx) => {
          const v = result.voucher;
          const name = flatNames[idx] ?? "";
          if (!v) return (
            <Card key={idx} className="p-4">
              <Alert tone="info">Voucher #{idx + 1} · Ref: {result.reference.slice(0, 18)}…</Alert>
            </Card>
          );
          return (
            <Card key={idx} className="overflow-hidden">
              <div className="bg-inbox text-white p-4">
                <div className="text-white/60 text-[12px] font-semibold">{name || v.profile}</div>
                {v.username === v.password ? (
                  <button onClick={() => copy(v.username, `u${idx}`)} className="mt-3 text-left w-full">
                    <div className="text-white/50 text-[11px]">Kode Voucher</div>
                    <div className="font-extrabold text-[22px] flex items-center gap-2 tracking-wider">
                      {v.username} {copied === `u${idx}` ? <CheckIcon size={15} /> : <CopyIcon size={15} className="opacity-60" />}
                    </div>
                  </button>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <button onClick={() => copy(v.username, `u${idx}`)} className="text-left">
                      <div className="text-white/50 text-[11px]">Username</div>
                      <div className="font-extrabold text-[16px] flex items-center gap-1.5">
                        {v.username} {copied === `u${idx}` ? <CheckIcon size={13} /> : <CopyIcon size={13} className="opacity-60" />}
                      </div>
                    </button>
                    <button onClick={() => copy(v.password, `p${idx}`)} className="text-left">
                      <div className="text-white/50 text-[11px]">Password</div>
                      <div className="font-extrabold text-[16px] flex items-center gap-1.5">
                        {v.password} {copied === `p${idx}` ? <CheckIcon size={13} /> : <CopyIcon size={13} className="opacity-60" />}
                      </div>
                    </button>
                  </div>
                )}
              </div>
              {v.expiryDate && (
                <div className="px-4 py-2 text-[11px] text-muted">Berlaku s/d {formatExpiry(v.expiryDate)}</div>
              )}
            </Card>
          );
        })}
      </div>

      {balance != null && (
        <p className="text-center text-[13px] text-muted mt-4">
          Saldo sekarang: <span className="font-bold text-ink">Rp{rupiah(balance)}</span>
        </p>
      )}
      <Button fullWidth onClick={onAgain} className="mt-5">Jual lagi</Button>
    </div>
  );
}
