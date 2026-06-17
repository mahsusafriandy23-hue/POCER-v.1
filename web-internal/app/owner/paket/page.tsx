"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { owner, type OwnerPackage, type OwnerOutlet, ApiError } from "@/lib/api";
import { humanDuration } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, Money, Badge, Switch, EmptyState, Skeleton, SectionTitle } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { TagIcon, BoltIcon } from "@/components/icons";

export default function OwnerPackages() {
  const sp = useSearchParams();
  const initialServer = sp.get("server");
  const [outlets, setOutlets] = useState<OwnerOutlet[]>([]);
  const [serverId, setServerId] = useState<number | "all">(initialServer ? Number(initialServer) : "all");
  const [packages, setPackages] = useState<OwnerPackage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<OwnerPackage | null>(null);

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
      <PageTitle title="Paket & Harga" subtitle="Atur harga jual dan harga agen tiap paket." />

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
                      {p.bonusLabel && <div className="text-[12px] text-emerald-600 font-semibold mt-0.5">🎁 {p.bonusLabel}</div>}
                    </div>
                    <Switch checked={p.isActive} onChange={(v) => quickToggle(p, v)} />
                  </div>
                  <Button variant="soft" className="mt-3 !py-2.5 w-full" onClick={() => setEditing(p)}>
                    Ubah harga
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

function EditPackageSheet({
  pkg,
  onClose,
  onSaved,
}: {
  pkg: OwnerPackage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState("");
  const [agentPrice, setAgentPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [promoLabel, setPromoLabel] = useState("");
  const [bonusLabel, setBonusLabel] = useState("");
  const [isFlashSale, setIsFlashSale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (pkg) {
      setPrice(String(pkg.price));
      setAgentPrice(pkg.agentPrice != null ? String(pkg.agentPrice) : "");
      setOriginalPrice(pkg.originalPrice != null ? String(pkg.originalPrice) : "");
      setPromoLabel(pkg.promoLabel ?? "");
      setBonusLabel(pkg.bonusLabel ?? "");
      setIsFlashSale(pkg.isFlashSale);
      setErr(null);
    }
  }, [pkg]);

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
    setLoading(true);
    try {
      await owner.updatePackage(pkg.id, {
        price: p,
        ...(a !== undefined ? { agentPrice: a } : {}),
        originalPrice: o,
        promoLabel,
        bonusLabel,
        isFlashSale,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan harga.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!pkg} onClose={onClose} title={pkg ? `Ubah paket · ${pkg.name}` : ""}>
      <form onSubmit={submit} className="space-y-3.5">
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
            label="Label bonus"
            value={bonusLabel}
            onChange={(e) => setBonusLabel(e.target.value)}
            placeholder='mis. "Bonus kuota malam"'
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
      </form>
    </Sheet>
  );
}
