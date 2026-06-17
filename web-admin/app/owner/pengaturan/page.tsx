"use client";

import { useEffect, useRef, useState } from "react";
import {
  owner,
  type OwnerSettings,
  type RouterTestResult,
  type QrisOverview,
  type QrisAccount,
  type QrisDecoded,
  ApiError,
} from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, SectionTitle, Skeleton, EmptyState, Switch } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { StoreIcon, SettingsIcon, CheckIcon, PlusIcon, WalletIcon } from "@/components/icons";

type Router = OwnerSettings["routers"][number];

export default function OwnerSettingsPage() {
  const [data, setData] = useState<OwnerSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Router | null>(null);

  async function reload() {
    try {
      setData(await owner.settings());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat pengaturan.");
    }
  }
  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-6">
      <PageTitle title="Pengaturan" subtitle="Hubungkan router, QRIS, dan WhatsApp bisnis Anda." />

      {err && <Alert tone="error">{err}</Alert>}

      {/* Brand/identitas penyedia dikelola di menu Penyedia Layanan (operator). */}

      {/* ── Router per-outlet ── */}
      <section>
        <SectionTitle>Router per outlet</SectionTitle>
        <p className="text-[12px] text-muted mb-2.5">
          Kredensial MikroTik tiap outlet. Disimpan terenkripsi. &quot;Test Koneksi&quot; hanya membaca
          (identity &amp; versi) — tidak mengubah apa pun di router.
        </p>
        <div className="space-y-2.5">
          {!data ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
          ) : data.routers.length === 0 ? (
            <Card>
              <EmptyState icon={<StoreIcon size={24} />} title="Belum ada outlet" />
            </Card>
          ) : (
            data.routers.map((r) => (
              <Card key={r.id} className="p-4 flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-haze text-azure grid place-items-center">
                  <StoreIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink truncate">{r.name}</span>
                    <Badge tone="neutral">{r.code}</Badge>
                    {r.configured ? (
                      <Badge tone="success">router diatur</Badge>
                    ) : (
                      <Badge tone="warn">belum diatur</Badge>
                    )}
                  </div>
                  <div className="text-[12px] text-muted mt-0.5">
                    {r.configured
                      ? `${r.mikrotikIp}:${r.mikrotikPort} · user ${r.mikrotikUser}`
                      : "IP / user / password belum diisi"}
                  </div>
                </div>
                <Button variant="soft" className="!py-2.5 !px-4" onClick={() => setEditing(r)}>
                  Atur
                </Button>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* ── Metode pembayaran (QRIS) ── */}
      <section>
        <SectionTitle>Metode Pembayaran</SectionTitle>
        <p className="text-[12px] text-muted mb-2.5">
          Akun QRIS penerima pembayaran. Tiap metode menempel ke satu brand dan otomatis dipakai semua outlet brand itu.
        </p>
        <QrisManager />
      </section>

      {/* ── WhatsApp ── */}
      <section>
        <SectionTitle>WhatsApp (pengiriman voucher &amp; notifikasi)</SectionTitle>
        {data ? <WhatsappForm settings={data} onSaved={reload} /> : <Skeleton className="h-[200px]" />}
      </section>

      <RouterSheet
        router={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    </div>
  );
}

// ───────────────────────── Router sheet ─────────────────────────

function RouterSheet({
  router,
  onClose,
  onSaved,
}: {
  router: Router | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("8728");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<RouterTestResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (router) {
      setIp(router.mikrotikIp ?? "");
      setPort(String(router.mikrotikPort ?? 8728));
      setUser(router.mikrotikUser ?? "");
      setPass("");
      setTest(null);
      setErr(null);
    }
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!router) return;
    setErr(null);
    setLoading(true);
    try {
      await owner.updateRouter(router.id, {
        mikrotikIp: ip.trim(),
        mikrotikPort: Number(port) || 8728,
        mikrotikUser: user.trim(),
        ...(pass.trim() ? { mikrotikPass: pass.trim() } : {}),
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan router.");
    } finally {
      setLoading(false);
    }
  }

  // Test uses the SAVED credentials, so persist first if there are unsaved edits.
  async function runTest() {
    if (!router) return;
    setErr(null);
    setTest(null);
    setTesting(true);
    try {
      if (ip.trim() && user.trim()) {
        await owner.updateRouter(router.id, {
          mikrotikIp: ip.trim(),
          mikrotikPort: Number(port) || 8728,
          mikrotikUser: user.trim(),
          ...(pass.trim() ? { mikrotikPass: pass.trim() } : {}),
        });
      }
      setTest(await owner.testRouter(router.id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menguji koneksi.");
    } finally {
      setTesting(false);
    }
  }

  async function clearCreds() {
    if (!router) return;
    setErr(null);
    setLoading(true);
    try {
      await owner.updateRouter(router.id, { clear: true });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menghapus kredensial.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!router} onClose={onClose} title={router ? `Router · ${router.code}` : ""}>
      <form onSubmit={save} className="space-y-3.5">
        <TextField
          label="IP / host MikroTik"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="mis. 192.168.88.1"
          inputMode="decimal"
        />
        <TextField
          label="Port API"
          value={port}
          onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="8728"
          hint="Default 8728 (API), 8729 (API-SSL)."
        />
        <TextField label="User API" value={user} onChange={(e) => setUser(e.target.value)} placeholder="mis. bqanggita" />
        <TextField
          label="Password API"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder={router?.hasPassword ? "•••••• (biarkan kosong = tetap)" : "password user API"}
          hint="Disimpan terenkripsi (AES-256-GCM). Kosongkan untuk mempertahankan yang lama."
        />

        {test &&
          (test.ok ? (
            <Alert tone="success">
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckIcon size={15} /> Terhubung
              </div>
              <div className="text-[12px] mt-1 opacity-90">
                {test.identity ? `Identity: ${test.identity}` : "Login OK"}
                {test.version ? ` · RouterOS ${test.version}` : ""}
                {test.board ? ` · ${test.board}` : ""}
              </div>
            </Alert>
          ) : (
            <Alert tone="error">Gagal: {test.error}</Alert>
          ))}

        {err && <Alert tone="error">{err}</Alert>}

        <div className="flex gap-2.5">
          <Button type="button" variant="soft" className="flex-1" loading={testing} onClick={runTest}>
            Test Koneksi
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            Simpan
          </Button>
        </div>

        {router?.configured && (
          <button
            type="button"
            onClick={clearCreds}
            className="w-full text-[13px] font-semibold text-rose-600 py-2 hover:bg-rose-50 rounded-xl transition-colors"
          >
            Hapus kredensial router
          </button>
        )}

        <p className="text-[12px] text-muted">
          Menyimpan kredensial <b>tidak</b> langsung mengaktifkan penjualan voucher ke router. Provisioning
          live diaktifkan terpisah setelah uji coba — demi keamanan jaringan Anda.
        </p>
      </form>
    </Sheet>
  );
}

// ───────────────────────── QRIS manager (multi-account) ─────────────────────────

function QrisManager() {
  const [data, setData] = useState<QrisOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState<QrisAccount | "new" | null>(null);

  async function reload() {
    try {
      setData(await owner.qris.list());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat QRIS.");
    }
  }
  useEffect(() => {
    reload();
  }, []);

  // Outlets owned but not yet routed to any QRIS — surfaced as a warning.
  const unrouted = data?.outlets.filter((o) => o.qrisAccountId == null) ?? [];

  // 1 brand = 1 QRIS: can a new QRIS be added? Only if some brand has none.
  const canAddQris = (() => {
    if (!data) return false;
    const used = new Set(data.accounts.map((a) => a.brandId));
    return (data.brands ?? []).some((b) => !used.has(b.id));
  })();

  return (
    <div className="space-y-2.5">
      {err && <Alert tone="error">{err}</Alert>}

      {unrouted.length > 0 && (
        <Alert tone="info">
          {unrouted.length} outlet belum diarahkan ke QRIS mana pun:{" "}
          <b>{unrouted.map((o) => o.code).join(", ")}</b>. Pembayaran di outlet ini belum punya tujuan.
        </Alert>
      )}

      {!data ? (
        Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[96px]" />)
      ) : data.accounts.length === 0 ? (
        <Card>
          <EmptyState icon={<SettingsIcon size={24} />} title="Belum ada akun QRIS" />
        </Card>
      ) : (
        data.accounts.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className={`h-11 w-11 rounded-2xl grid place-items-center shrink-0 ${a.configured ? "bg-haze text-azure" : "bg-amber-50 text-amber-600"}`}>
                <WalletIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-ink truncate">{a.merchant || a.label}</span>
                  {a.configured ? (
                    <Badge tone="success">terpasang</Badge>
                  ) : (
                    <Badge tone="warn">belum diisi</Badge>
                  )}
                  {a.configured && !(a.gobiz?.connected || a.bri?.configured) && (
                    <Badge tone="danger">deteksi off</Badge>
                  )}
                  {!a.isActive && <Badge tone="neutral">nonaktif</Badge>}
                </div>
                {/* meta line: brand · default top-up */}
                <div className="text-[12px] text-muted mt-0.5 truncate">
                  {[
                    a.brand ? a.brand.name : null,
                    a.isTopupDefault ? "default top-up" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Metode pembayaran"}
                </div>
                {(() => {
                  // Outlets of this method's brand (1 brand = 1 method → it serves them all).
                  // Solid chip = currently routes here; outline = brand outlet routing elsewhere.
                  const provOutlets = (data.outlets ?? []).filter((o) =>
                    a.brandId != null ? o.brandId === a.brandId : true,
                  );
                  return (
                    <div className="mt-2 text-[12px]">
                      <span className="text-muted">Outlet: </span>
                      {provOutlets.length === 0 ? (
                        <span className="text-amber-600 font-medium">brand belum punya outlet</span>
                      ) : (
                        <span className="inline-flex flex-wrap gap-1.5 align-middle">
                          {provOutlets.map((o) => {
                            const here = o.qrisAccountId === a.id;
                            return (
                              <span
                                key={o.id}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  here ? "bg-haze text-azure" : "border border-line text-muted"
                                }`}
                                title={here ? "Memakai metode ini" : "Outlet brand ini, saat ini ke metode lain"}
                              >
                                {o.code}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <Button variant="soft" className="!py-2.5 !px-4 shrink-0" onClick={() => setTarget(a)}>
                Atur
              </Button>
            </div>
          </Card>
        ))
      )}

      {canAddQris ? (
        <button
          type="button"
          onClick={() => setTarget("new")}
          className="w-full rounded-2xl border-2 border-dashed border-line hover:border-azure/50 hover:bg-haze/50 text-muted hover:text-azure transition-colors py-3.5 text-[14px] font-bold inline-flex items-center justify-center gap-1.5"
        >
          <PlusIcon size={16} /> Tambah metode pembayaran
        </button>
      ) : (
        data && (
          <p className="text-center text-[12px] text-muted py-2">
            Setiap brand sudah punya QRIS. Satu brand = satu QRIS.
          </p>
        )
      )}

      <QrisAccountSheet
        target={target}
        overview={data}
        onClose={() => setTarget(null)}
        onSaved={() => {
          setTarget(null);
          reload();
        }}
      />
    </div>
  );
}

function QrisAccountSheet({
  target,
  overview,
  onClose,
  onSaved,
}: {
  target: QrisAccount | "new" | null;
  overview: QrisOverview | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = target === "new";
  const account = target && target !== "new" ? target : null;

  const [text, setText] = useState(""); // decoded QRIS payload (from photo), saved on submit
  const [merchant, setMerchant] = useState("");
  const [nmid, setNmid] = useState("");
  const [active, setActive] = useState(true);
  const [topupDefault, setTopupDefault] = useState(false);
  const [payMode, setPayMode] = useState<"dynamic" | "static-amount" | "static">("static-amount");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<QrisDecoded | null>(null);
  const [uploading, setUploading] = useState(false);
  const [decodeErr, setDecodeErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setDecodeErr(null);
    setDecoded(null);
    setUploading(true);
    try {
      const res = await owner.qris.decode(file);
      setText(res.qrisText);
      setDecoded(res);
      if (res.merchant) setMerchant(res.merchant);
      if (res.nmid) setNmid(res.nmid);
    } catch (e) {
      setDecodeErr(e instanceof ApiError ? e.message : "Gagal membaca QRIS dari gambar.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!target) return;
    setErr(null);
    setText("");
    setDecoded(null);
    setDecodeErr(null);
    setUploading(false);
    if (account) {
      setMerchant(account.merchant || account.label);
      setNmid(account.nmid ?? "");
      setActive(account.isActive);
      setTopupDefault(account.isTopupDefault);
      setPayMode(account.paymentMode ?? "static-amount");
      setBrandId(account.brandId ?? null);
    } else {
      setMerchant("");
      setNmid("");
      setActive(true);
      setTopupDefault(false);
      setPayMode("static-amount");
      // New QRIS → default to the first brand that doesn't have a QRIS yet.
      const used = new Set((overview?.accounts ?? []).map((a) => a.brandId));
      const firstFree = (overview?.brands ?? []).find((b) => !used.has(b.id));
      setBrandId(firstFree?.id ?? null);
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1 brand = 1 QRIS: brands that already own a QRIS (other than this one)
  // can't be chosen — they're excluded from the dropdown.
  const usedBrandIds = new Set(
    (overview?.accounts ?? [])
      .filter((a) => a.id !== account?.id)
      .map((a) => a.brandId)
      .filter((x): x is number => x != null),
  );
  const availableBrands = (overview?.brands ?? []).filter((b) => !usedBrandIds.has(b.id));
  const noBrandLeft = isNew && availableBrands.length === 0;

  // Every outlet of the chosen brand — this QRIS serves them all (1 brand = 1 QRIS).
  const coveredOutlets = (overview?.outlets ?? []).filter((o) =>
    brandId != null ? o.brandId === brandId : false,
  );
  // Can this method's payments be detected (marked lunas) automatically?
  const canDetect = !!account && (account.gobiz?.connected || account.bri?.configured);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = merchant.trim();
    if (!name) {
      setErr("Nama pembayaran wajib diisi.");
      return;
    }
    if (!brandId) {
      setErr("Pilih brand dulu.");
      return;
    }
    if (noBrandLeft) {
      setErr("Semua brand sudah punya QRIS. Edit/hapus yang ada dulu.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      let id = account?.id;
      // label is kept in sync with the merchant name (the single visible name).
      if (isNew) {
        const created = await owner.qris.create({
          label: name,
          ...(text.trim() ? { qrisText: text.trim() } : {}),
          merchant: name,
          nmid: nmid.trim(),
          ...(brandId ? { brandId } : {}),
        });
        id = created.id;
      } else if (id) {
        await owner.qris.update(id, {
          label: name,
          ...(text.trim() ? { qrisText: text.trim() } : {}),
          merchant: name,
          nmid: nmid.trim(),
          isActive: active,
          isTopupDefault: topupDefault,
          paymentMode: payMode,
          ...(brandId ? { brandId } : {}),
        });
      }
      // Routing is handled server-side: a configured QRIS becomes the provider's
      // single receiver for all its outlets.
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan QRIS.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!account) return;
    setErr(null);
    setLoading(true);
    try {
      await owner.qris.remove(account.id);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menghapus QRIS.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={isNew ? "Metode pembayaran baru" : (account?.merchant || account?.label || "QRIS")}>
      <form onSubmit={save} className="space-y-3.5">
        <Alert tone="info">
          Gunakan <b>QRIS dari GoBiz / GoPay</b>. Unggah foto/screenshot QRIS-nya — datanya dibaca otomatis.
        </Alert>

        {/* Which BRAND owns this payment method → its outlets follow. */}
        <div className="rounded-2xl bg-white border border-line px-4 py-3.5 space-y-2">
          <span className="block text-[14px] font-semibold text-ink">Brand</span>
          <select
            value={brandId ?? ""}
            onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl bg-haze border border-line px-3 py-2.5 text-[13px] text-ink outline-none focus:border-azure"
          >
            <option value="">— pilih brand —</option>
            {availableBrands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted">
            QRIS ini jadi penerima pembayaran untuk <b>semua outlet</b> brand ini. Satu brand hanya boleh
            punya satu QRIS — brand yang sudah punya tidak muncul di daftar.
          </p>
        </div>

        <div>
          <span className="block text-[13px] font-semibold text-ink mb-1.5">Foto QRIS merchant</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-2xl border-2 border-dashed border-line hover:border-azure hover:bg-haze/50 px-4 py-5 text-center transition-colors disabled:opacity-60"
          >
            <span className="text-[14px] font-semibold text-azure">
              {uploading ? "Membaca QRIS…" : "📷 Upload foto QRIS"}
            </span>
            <span className="block text-[12px] text-muted mt-0.5">
              Foto jelas, QR tidak terpotong (maks 5MB)
            </span>
          </button>

          {decodeErr && (
            <div className="mt-2">
              <Alert tone="error">{decodeErr}</Alert>
            </div>
          )}

          {decoded && (
            <div className="mt-2 space-y-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-700">
                  <CheckIcon size={15} /> QRIS terbaca
                </div>
                <div className="text-[12px] text-emerald-700/90 mt-1">
                  {decoded.merchant ?? "(merchant tak terbaca)"}
                  {decoded.nmid ? ` · NMID ${decoded.nmid}` : ""}
                  {decoded.acquirer ? ` · ${decoded.acquirer}` : ""}
                </div>
              </div>
              {!decoded.isGobiz && (
                <Alert tone="error">
                  QRIS ini sepertinya <b>bukan dari GoBiz/GoPay</b>. Untuk saat ini hanya QRIS GoBiz/GoPay
                  yang didukung — periksa kembali sebelum menyimpan.
                </Alert>
              )}
            </div>
          )}

          {!decoded && account?.configured && (
            <div className="mt-2 text-[12px] text-muted">
              Payload QRIS sudah tersimpan. Unggah foto baru hanya jika ingin mengganti.
            </div>
          )}
        </div>

        <TextField
          label="Nama pembayaran (merchant)"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="otomatis dari foto QRIS"
          hint="Nama ini yang tampil sebagai metode pembayaran. Terisi otomatis dari foto QRIS, bisa diedit."
          required
        />
        <TextField
          label="NMID (opsional)"
          value={nmid}
          onChange={(e) => setNmid(e.target.value)}
          placeholder="National Merchant ID"
        />

        {!isNew && (
          <>
            <div className="rounded-2xl bg-white border border-line px-4 py-3.5 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink">Akun aktif</span>
              <Switch checked={active} onChange={setActive} />
            </div>
            <div className="rounded-2xl bg-white border border-line px-4 py-3.5 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-ink">Merchant default top-up</span>
                <span className="block text-[12px] text-muted mt-0.5">
                  Top-up saldo pelanggan (tanpa outlet) masuk ke QRIS ini. Hanya satu per brand.
                </span>
              </span>
              <Switch checked={topupDefault} onChange={setTopupDefault} />
            </div>
            <div className="rounded-2xl bg-white border border-line px-4 py-3.5 space-y-2">
              <span className="block text-[14px] font-semibold text-ink">Mode QR pembayaran</span>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value as "dynamic" | "static-amount" | "static")}
                className="w-full rounded-xl bg-haze border border-line px-3 py-2.5 text-[13px] text-ink outline-none focus:border-azure"
              >
                <option value="dynamic">Dinamis (POI 12 + nominal) — merchant QRIS penuh</option>
                <option value="static-amount">Statis + nominal — nominal terisi otomatis</option>
                <option value="static">Statis murni — pelanggan ketik nominal sendiri</option>
              </select>
              <p className="text-[11px] text-muted">
                Jika bank menolak (&quot;merchant not found&quot;), turunkan ke <b>Statis + nominal</b>, lalu <b>Statis murni</b>.
                Merchant baru/belum aktif penuh biasanya hanya menerima <b>Statis murni</b>.
              </p>
            </div>
          </>
        )}

        {/* Detection warning — the root cause of "terbayar tapi tidak lunas". */}
        {!isNew && account?.configured && !canDetect && (
          <Alert tone="error">
            QRIS ini <b>belum tersambung deteksi pembayaran</b> (GoBiz/BRI). Pembayaran ke sini tidak akan
            otomatis tercatat lunas. Sambungkan GoBiz di bawah, atau pilih QRIS yang sudah tersambung sebagai
            penerima brand ini.
          </Alert>
        )}

        <div>
          <span className="block text-[13px] font-semibold text-ink mb-1.5">Berlaku untuk outlet</span>
          <div className="rounded-2xl bg-white border border-line px-4 py-3.5">
            {coveredOutlets.length === 0 ? (
              <p className="text-[12px] text-muted">
                {!brandId
                  ? "Pilih brand dulu untuk melihat outletnya."
                  : "Brand ini belum punya outlet."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {coveredOutlets.map((o) => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-haze border border-line px-2.5 py-1 text-[12px] font-semibold text-ink"
                  >
                    <CheckIcon size={12} className="text-azure" />
                    {o.name}
                    <span className="text-muted font-normal">{o.code}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="block text-[12px] text-muted mt-1.5">
            Setelah disimpan, QRIS ini otomatis dipakai <b>semua outlet</b> brand di atas. Satu brand = satu QRIS.
          </span>
        </div>

        {noBrandLeft && (
          <Alert tone="info">
            Semua brand sudah punya QRIS. Satu brand hanya boleh punya satu QRIS — edit atau hapus
            QRIS yang ada untuk menggantinya.
          </Alert>
        )}
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading} disabled={noBrandLeft}>
          {isNew ? "Buat QRIS" : "Simpan"}
        </Button>

        {!isNew && (
          <button
            type="button"
            onClick={remove}
            className="w-full text-[13px] font-semibold text-rose-600 py-2 hover:bg-rose-50 rounded-xl transition-colors"
          >
            Hapus akun QRIS ini
          </button>
        )}
      </form>

      {account && (
        <div className="mt-5 pt-5 border-t border-line">
          <GobizConnect account={account} onChanged={onSaved} />
        </div>
      )}
    </Sheet>
  );
}

// ───────────────────────── GoBiz connect ─────────────────────────

/** Console snippet: paste in app.gobiz.com BEFORE login → hooks /goid/token responses and
 *  pops up the refresh_token (also copies it to clipboard) the moment login succeeds. */
const GOBIZ_CAPTURE_SCRIPT =
  `(()=>{const grab=(t)=>{try{const j=typeof t==='string'?JSON.parse(t):t;const rt=j&&(j.refresh_token||(j.data&&j.data.refresh_token));if(rt){try{copy(rt)}catch(e){}window.prompt('Copy refresh_token ini → paste ke form Hubungkan GoBiz:',rt);}}catch(e){}};const has=(u)=>(''+u).indexOf('goid/token')>=0;const f=window.fetch;window.fetch=async(...a)=>{const r=await f(...a);if(has(a[0]&&(a[0].url||a[0])))r.clone().text().then(grab).catch(()=>{});return r;};const o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u,...r){this.addEventListener('load',()=>{if(has(u))grab(this.responseText)});return o.call(this,m,u,...r)};console.log('%c\\uD83D\\uDFE2 Penangkap token AKTIF \\u2014 silakan login (HP + OTP) sekarang','color:#0a0;font-size:14px;font-weight:bold');})();`;

function GobizConnect({ account, onChanged }: { account: QrisAccount; onChanged: () => void }) {
  const connected = account.gobiz?.connected;
  const [refreshTok, setRefreshTok] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(GOBIZ_CAPTURE_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Gagal menyalin — pilih teks script lalu salin manual.");
    }
  }

  async function connectToken() {
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      await owner.qris.gobiz.connectRefreshToken(account.id, refreshTok.trim());
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Token tidak valid / sesi GoBiz gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setErr(null);
    setBusy(true);
    try {
      await owner.qris.gobiz.disconnect(account.id);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memutus koneksi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-ink">Hubungkan GoBiz</span>
        {connected ? <Badge tone="success">terhubung</Badge> : <Badge tone="warn">belum</Badge>}
      </div>
      <p className="text-[12px] text-muted">
        Diperlukan agar pembayaran pelanggan ke QRIS ini terdeteksi otomatis (voucher keluar tanpa konfirmasi manual).
      </p>

      {connected ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 space-y-1">
          <div className="text-[13px] font-semibold text-emerald-700">
            Merchant terhubung{account.gobiz?.merchantId ? ` · ${account.gobiz.merchantId}` : ""}
          </div>
          {account.gobiz?.phone && <div className="text-[12px] text-emerald-700/90">HP: {account.gobiz.phone}</div>}
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="text-[12px] font-semibold text-rose-600 hover:underline disabled:opacity-60"
          >
            Putuskan koneksi
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-haze border border-line px-4 py-3 text-[12px] text-ink/80 space-y-2">
            <p className="font-semibold text-ink">Cara hubungkan (login di browser, ~2 menit):</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Buka <span className="font-mono">app.gobiz.com</span> di Chrome → tekan <b>F12</b> → tab <b>Console</b>.</li>
              <li>Klik <b>Salin script</b> di bawah → tempel di Console → <b>Enter</b> (sebelum login).</li>
              <li><b>Login seperti biasa</b> (HP + OTP). Saat berhasil, muncul <b>popup berisi token</b>.</li>
              <li>Copy token dari popup → tempel ke kolom di bawah → <b>Hubungkan</b>.</li>
            </ol>
            <button
              type="button"
              onClick={copyScript}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-ink/90 transition-colors"
            >
              {copied ? "✓ Tersalin" : "Salin script"}
            </button>
            <p className="text-[11px] text-muted">
              Alternatif manual: F12 → <b>Network</b> → filter <span className="font-mono">token</span> → buka request → <b>Response</b> → copy <span className="font-mono">refresh_token</span>.
            </p>
          </div>
          <textarea
            value={refreshTok}
            onChange={(e) => setRefreshTok(e.target.value)}
            rows={3}
            placeholder="tempel refresh_token di sini"
            className="w-full rounded-2xl bg-white border border-line px-4 py-3 text-[13px] text-ink outline-none focus:border-azure focus:ring-2 focus:ring-azure/20 transition-all font-mono"
          />
          <Button type="button" fullWidth loading={busy} onClick={connectToken} disabled={!refreshTok.trim()}>
            Hubungkan
          </Button>
        </>
      )}

      {info && <Alert tone="info">{info}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
    </div>
  );
}


// ───────────────────────── WhatsApp form ─────────────────────────

function WhatsappForm({ settings, onSaved }: { settings: OwnerSettings; onSaved: () => void }) {
  const [number, setNumber] = useState(settings.whatsapp.number ?? "");
  const [gatewayUrl, setGatewayUrl] = useState(settings.whatsapp.gatewayUrl ?? "");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    setLoading(true);
    try {
      await owner.updateWhatsapp({
        waNumber: number.trim(),
        waGatewayUrl: gatewayUrl.trim(),
        ...(key.trim() ? { waGatewayKey: key.trim() } : {}),
      });
      setKey("");
      setOk(true);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={save} className="space-y-3.5">
        <TextField
          label="Nomor WhatsApp admin"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="mis. 6281xxxxxxxxx"
          inputMode="tel"
          hint="Nomor untuk menerima notifikasi & sebagai pengirim voucher."
        />
        <TextField
          label="URL gateway WhatsApp"
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
          placeholder="mis. http://localhost:3001"
          hint="Endpoint gateway (Baileys/penyedia) yang mengirim pesan."
        />
        <TextField
          label="API key gateway"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={settings.whatsapp.hasKey ? "•••••• (tersimpan — isi untuk ganti)" : "kosong jika tak perlu"}
          hint="Disimpan terenkripsi. Kosongkan untuk mempertahankan yang lama."
        />

        {ok && <Alert tone="success">WhatsApp tersimpan.</Alert>}
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Simpan WhatsApp
        </Button>
      </form>
    </Card>
  );
}
