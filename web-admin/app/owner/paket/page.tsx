"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { owner, type OwnerPackage, type OwnerOutlet, ApiError } from "@/lib/api";
import { humanDuration } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, Money, Badge, Switch, EmptyState, Skeleton, SectionTitle } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { TagIcon, BoltIcon, ChevronDownIcon } from "@/components/icons";

export default function OwnerPackages() {
  const sp = useSearchParams();
  const initialServer = sp.get("server");
  const [outlets, setOutlets] = useState<OwnerOutlet[]>([]);
  const [serverId, setServerId] = useState<number | "all">(initialServer ? Number(initialServer) : "all");
  const [packages, setPackages] = useState<OwnerPackage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<OwnerPackage | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadOutlets() {
    try {
      setOutlets(await owner.outlets());
    } catch {
      /* ignore */
    }
  }
  async function loadPackages() {
    setPackages(null);
    try {
      setPackages(await owner.packages(serverId === "all" ? undefined : serverId));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat paket.");
    }
  }
  useEffect(() => {
    loadOutlets();
  }, []);
  useEffect(() => {
    loadPackages();
  }, [serverId]);

  const grouped = useMemo(() => {
    const map = new Map<string, OwnerPackage[]>();
    (packages ?? []).forEach((p) => {
      const key = p.server?.name ?? "Tanpa outlet";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries());
  }, [packages]);

  async function quickToggle(pkg: OwnerPackage, active: boolean) {
    setPackages((prev) => prev?.map((p) => (p.id === pkg.id ? { ...p, isActive: active } : p)) ?? prev);
    try {
      await owner.updatePackage(pkg.id, { isActive: active });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal mengubah status paket.");
      loadPackages();
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageTitle title="Paket & Harga" subtitle="Atur harga jual dan harga agen tiap paket." />
        <Button className="shrink-0 !py-2.5 !px-4" onClick={() => setCreating(true)} disabled={outlets.length === 0}>
          + Paket
        </Button>
      </div>

      {err && <Alert tone="error">{err}</Alert>}

      {/* Outlet filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        <Chip active={serverId === "all"} onClick={() => setServerId("all")}>
          Semua
        </Chip>
        {outlets.map((o) => (
          <Chip key={o.id} active={serverId === o.id} onClick={() => setServerId(o.id)}>
            {o.name}
          </Chip>
        ))}
      </div>

      {!packages ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <EmptyState icon={<TagIcon size={24} />} title="Belum ada paket" hint="Outlet ini belum punya paket." />
        </Card>
      ) : (
        grouped.map(([name, list]) => (
          <div key={name} className="mb-6">
            {serverId === "all" && <SectionTitle>{name}</SectionTitle>}
            <div className="space-y-2.5">
              {list.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink truncate">{p.name}</span>
                        <Badge tone="neutral">{humanDuration(p.duration)}</Badge>
                        {p.isFlashSale && <Badge tone="danger">⚡ Flash</Badge>}
                        {p.promoLabel && <Badge tone="warn">{p.promoLabel}</Badge>}
                      </div>
                      <div className="text-[13px] text-muted mt-1 flex items-center gap-1.5">
                        Jual{" "}
                        {p.originalPrice && p.originalPrice > p.price && (
                          <span className="line-through text-dim">Rp{p.originalPrice.toLocaleString("id-ID")}</span>
                        )}
                        <Money value={p.price} className="font-bold text-ink" /> · Agen{" "}
                        <Money value={p.agentPrice ?? p.price} className="font-bold text-ink" />
                      </div>
                      <div className="text-[12px] mt-1 flex items-center gap-1.5">
                        <span className="text-muted">User-profile router:</span>
                        {p.mikrotikProfile ? (
                          <span className="inline-flex items-center rounded-md bg-haze border border-line px-1.5 py-0.5 font-mono text-[11px] font-bold text-azure">
                            {p.mikrotikProfile}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[11px] font-bold text-amber-600">
                            belum diset (pakai &quot;default&quot;)
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] mt-0.5 text-muted">
                        Kuota: <span className="font-semibold text-ink">{p.dataLimit || "Unlimited"}</span>
                      </div>
                      {p.bonusLabel && <div className="text-[12px] text-azure font-semibold mt-0.5">⚡ {p.bonusLabel}</div>}
                    </div>
                    <Switch checked={p.isActive} onChange={(v) => quickToggle(p, v)} />
                  </div>
                  <Button variant="soft" className="mt-3 !py-2.5 w-full" onClick={() => setEditing(p)}>
                    Edit paket
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <EditPackageSheet
        pkg={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          loadPackages();
        }}
        onDeleted={() => {
          setEditing(null);
          loadPackages();
        }}
      />

      <CreatePackageSheet
        open={creating}
        outlets={outlets}
        defaultServerId={serverId === "all" ? outlets[0]?.id : serverId}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          loadPackages();
        }}
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold border transition-colors ${
        active ? "bg-azure text-white border-azure" : "bg-white text-muted border-line"
      }`}
    >
      {children}
    </button>
  );
}

function ProfileSelect({
  serverId,
  value,
  onChange,
}: {
  serverId?: number | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    if (!serverId) { setProfiles([]); setFetchErr(null); return; }
    setLoading(true);
    setFetchErr(null);
    owner
      .routerProfiles(serverId)
      .then((r) => {
        setProfiles(r.profiles);
        if (!r.ok) setFetchErr(r.error ?? "Gagal memuat profil.");
      })
      .catch(() => setFetchErr("Gagal memuat profil dari router."))
      .finally(() => setLoading(false));
  }, [serverId]);

  const options = profiles.length > 0 ? profiles : value ? [value] : [];

  return (
    <div>
      <label className="block text-[13px] font-semibold text-ink mb-1.5">User-profile router</label>
      {loading ? (
        <div className="h-[44px] rounded-xl border border-line bg-haze flex items-center px-3 text-[13px] text-muted">
          Memuat profil dari router…
        </div>
      ) : options.length > 0 ? (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-[44px] rounded-xl border border-line bg-white pl-3 pr-9 text-[14px] text-ink appearance-none focus:outline-none focus:ring-2 focus:ring-azure/30 focus:border-azure"
          >
            <option value="">— pilih profil —</option>
            {options.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            {value && !options.includes(value) && (
              <option value={value}>{value} (manual)</option>
            )}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <ChevronDownIcon size={16} />
          </span>
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="mis. VOUCHER-NEMBAK"
          className="w-full h-[44px] rounded-xl border border-line bg-white px-3 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-azure/30 focus:border-azure"
        />
      )}
      {fetchErr && !loading && (
        <p className="mt-1 text-[11px] text-amber-600">{fetchErr} — ketik manual.</p>
      )}
      {!fetchErr && !loading && profiles.length === 0 && !serverId && (
        <p className="mt-1 text-[11px] text-muted">Ketik nama profil hotspot di router (mis. default).</p>
      )}
      {!fetchErr && !loading && profiles.length === 0 && serverId && (
        <p className="mt-1 text-[11px] text-muted">Router belum terkonfigurasi — ketik manual.</p>
      )}
      <p className="mt-1 text-[11px] text-muted">
        Harus <b>sama persis</b> dengan profil hotspot di MikroTik. Kosong = pakai <span className="font-mono">default</span>.
      </p>
    </div>
  );
}

function EditPackageSheet({
  pkg,
  onClose,
  onSaved,
  onDeleted,
}: {
  pkg: OwnerPackage | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [profile, setProfile] = useState("");
  const [dataLimit, setDataLimit] = useState("");
  const [price, setPrice] = useState("");
  const [agentPrice, setAgentPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [promoLabel, setPromoLabel] = useState("");
  const [bonusLabel, setBonusLabel] = useState("");
  const [isFlashSale, setIsFlashSale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (pkg) {
      setName(pkg.name);
      setDuration(pkg.duration ?? "");
      setProfile(pkg.mikrotikProfile ?? "");
      setDataLimit(pkg.dataLimit ?? "");
      setPrice(String(pkg.price));
      setAgentPrice(pkg.agentPrice != null ? String(pkg.agentPrice) : "");
      setOriginalPrice(pkg.originalPrice != null ? String(pkg.originalPrice) : "");
      setPromoLabel(pkg.promoLabel ?? "");
      setBonusLabel(pkg.bonusLabel ?? "");
      setIsFlashSale(pkg.isFlashSale);
      setErr(null);
      setConfirmDel(false);
    }
  }, [pkg]);

  async function handleDelete() {
    if (!pkg) return;
    setErr(null);
    setDeleting(true);
    try {
      await owner.deletePackage(pkg.id);
      onDeleted();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menghapus paket.");
      setConfirmDel(false);
    } finally {
      setDeleting(false);
    }
  }

  const discount =
    Number(originalPrice) > Number(price) && Number(price) > 0
      ? Math.round((1 - Number(price) / Number(originalPrice)) * 100)
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pkg) return;
    setErr(null);
    const p = Number(price);
    const a = agentPrice.trim() === "" ? undefined : Number(agentPrice);
    const o = originalPrice.trim() === "" ? 0 : Number(originalPrice);
    if (!Number.isFinite(p) || p < 0) {
      setErr("Harga jual tidak valid.");
      return;
    }
    if (a !== undefined && (!Number.isFinite(a) || a < 0)) {
      setErr("Harga agen tidak valid.");
      return;
    }
    if (a !== undefined && a > p) {
      setErr("Harga agen tidak boleh lebih besar dari harga jual.");
      return;
    }
    if (o > 0 && o <= p) {
      setErr("Harga coret harus lebih besar dari harga jual.");
      return;
    }
    if (!name.trim()) {
      setErr("Nama paket wajib diisi.");
      return;
    }
    if (!duration.trim()) {
      setErr("Durasi wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      await owner.updatePackage(pkg.id, {
        name: name.trim(),
        duration: duration.trim(),
        mikrotikProfile: profile.trim(),
        dataLimit: dataLimit.trim(),
        price: p,
        ...(a !== undefined ? { agentPrice: a } : {}),
        originalPrice: o,
        promoLabel,
        bonusLabel,
        isFlashSale,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan paket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!pkg} onClose={onClose} title={pkg ? `Edit paket · ${pkg.name}` : ""}>
      <form onSubmit={submit} className="space-y-3.5">
        <TextField
          label="Nama paket"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. NEMBAK"
          required
        />
        <TextField
          label="Durasi (tampilan saja)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="mis. 1 Jam, 1 Hari, 30 Menit"
          hint="Hanya ditampilkan ke pelanggan. Masa aktif sesungguhnya ditentukan oleh user-profile di MikroTik."
          required
        />
        <ProfileSelect serverId={pkg?.server?.id} value={profile} onChange={setProfile} />
        <TextField
          label="Kuota"
          value={dataLimit}
          onChange={(e) => setDataLimit(e.target.value)}
          placeholder="mis. Unlimited, 10 GB, 50 GB"
          hint='Tampil di kolom Kuota kartu paket. Kosong = "Unlimited".'
        />
        <TextField
          label="Harga jual (pelanggan)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="numeric"
          prefix="Rp"
          required
        />
        <TextField
          label="Harga agen"
          value={agentPrice}
          onChange={(e) => setAgentPrice(e.target.value)}
          inputMode="numeric"
          prefix="Rp"
          hint="Harga yang dibayar agen dari saldo. Kosongkan = sama dengan harga jual."
        />

        <div className="rounded-2xl bg-white border border-line p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-extrabold text-ink">Promo (tampil di storefront)</span>
            {discount != null && <Badge tone="danger">-{discount}%</Badge>}
          </div>
          <TextField
            label="Harga coret (asli)"
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
            inputMode="numeric"
            prefix="Rp"
            hint="Kosong = tanpa promo. Harus > harga jual."
          />
          <TextField
            label="Label promo"
            value={promoLabel}
            onChange={(e) => setPromoLabel(e.target.value)}
            placeholder='mis. "Flash Sale", "Promo"'
          />
          <TextField
            label="Kecepatan"
            value={bonusLabel}
            onChange={(e) => setBonusLabel(e.target.value)}
            placeholder='mis. Up to 10 Mbps, 5 Mbps Download'
          />
          <label className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">Tandai Flash Sale</span>
            <Switch checked={isFlashSale} onChange={setIsFlashSale} />
          </label>
        </div>

        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Simpan paket
        </Button>

        <div className="pt-2 mt-1 border-t border-line">
          {!confirmDel ? (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="w-full text-center text-[13px] font-semibold text-rose-600 py-2.5 rounded-xl hover:bg-rose-50 transition-colors"
            >
              Hapus paket
            </button>
          ) : (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 space-y-3">
              <p className="text-[13px] text-rose-800 font-medium">
                Hapus paket <b>{pkg?.name}</b>? Tindakan ini permanen. Paket yang sudah dipakai pada
                transaksi tidak bisa dihapus — nonaktifkan saja.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="soft" className="flex-1" onClick={() => setConfirmDel(false)} disabled={deleting}>
                  Batal
                </Button>
                <Button type="button" className="flex-1 !bg-rose-600" loading={deleting} onClick={handleDelete}>
                  Ya, hapus
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
}

function CreatePackageSheet({
  open,
  outlets,
  defaultServerId,
  onClose,
  onCreated,
}: {
  open: boolean;
  outlets: OwnerOutlet[];
  defaultServerId?: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serverId, setServerId] = useState<number | undefined>(defaultServerId);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [agentPrice, setAgentPrice] = useState("");
  const [profile, setProfile] = useState("");
  const [dataLimit, setDataLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setServerId(defaultServerId ?? outlets[0]?.id);
      setName("");
      setDuration("");
      setPrice("");
      setAgentPrice("");
      setProfile("");
      setDataLimit("");
      setErr(null);
    }
  }, [open, defaultServerId, outlets]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!serverId) {
      setErr("Pilih outlet dulu.");
      return;
    }
    const p = Number(price);
    const a = agentPrice.trim() === "" ? undefined : Number(agentPrice);
    if (!name.trim()) {
      setErr("Nama paket wajib diisi.");
      return;
    }
    if (!duration.trim()) {
      setErr("Durasi wajib diisi.");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      setErr("Harga jual tidak valid.");
      return;
    }
    if (a !== undefined && (!Number.isFinite(a) || a < 0)) {
      setErr("Harga agen tidak valid.");
      return;
    }
    if (a !== undefined && a > p) {
      setErr("Harga agen tidak boleh lebih besar dari harga jual.");
      return;
    }
    setLoading(true);
    try {
      await owner.createPackage({
        serverId,
        name: name.trim(),
        duration: duration.trim(),
        price: p,
        ...(a !== undefined ? { agentPrice: a } : {}),
        ...(profile.trim() ? { mikrotikProfile: profile.trim() } : {}),
        ...(dataLimit.trim() ? { dataLimit: dataLimit.trim() } : {}),
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal membuat paket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Paket baru">
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="block text-[13px] font-semibold text-ink mb-1.5">Outlet</label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {outlets.map((o) => (
              <Chip key={o.id} active={serverId === o.id} onClick={() => setServerId(o.id)}>
                {o.name}
              </Chip>
            ))}
          </div>
        </div>
        <TextField label="Nama paket" value={name} onChange={(e) => setName(e.target.value)} placeholder='mis. "Voucher 1 Hari"' required />
        <TextField
          label="Durasi (tampilan saja)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="mis. 1 Jam, 1 Hari, 30 Menit"
          hint="Hanya ditampilkan ke pelanggan. Masa aktif sesungguhnya ditentukan oleh user-profile di MikroTik."
          required
        />
        <TextField label="Harga jual (pelanggan)" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" prefix="Rp" required />
        <TextField
          label="Harga agen"
          value={agentPrice}
          onChange={(e) => setAgentPrice(e.target.value)}
          inputMode="numeric"
          prefix="Rp"
          hint="Kosongkan = sama dengan harga jual."
        />
        <ProfileSelect serverId={serverId} value={profile} onChange={setProfile} />
        <TextField
          label="Kuota (opsional)"
          value={dataLimit}
          onChange={(e) => setDataLimit(e.target.value)}
          placeholder="mis. Unlimited, 10 GB, 50 GB"
          hint='Tampil di kolom Kuota kartu paket. Kosong = "Unlimited".'
        />
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          Buat paket
        </Button>
      </form>
    </Sheet>
  );
}
