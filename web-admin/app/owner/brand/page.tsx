"use client";

import { useEffect, useState } from "react";
import { owner, type Brand, ApiError } from "@/lib/api";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, EmptyState, Skeleton } from "@/components/kit";
import { Button, TextField, Alert } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { BoxIcon, PlusIcon, StoreIcon, WalletIcon, UsersIcon } from "@/components/icons";

export default function OwnerBrands() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Brand | "new" | null>(null);

  async function reload() {
    try {
      setBrands(await owner.brands.list());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat brand.");
    }
  }
  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <PageTitle
        title="Brand"
        subtitle="Satu pemilik bisa punya beberapa brand. Outlet, QRIS, dan agen menempel ke brand."
        action={
          <Button onClick={() => setSheet("new")} className="!py-2.5 !px-4">
            <PlusIcon size={18} /> Brand
          </Button>
        }
      />

      {err && <Alert tone="error">{err}</Alert>}

      <div className="space-y-2.5">
        {!brands ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)
        ) : brands.length === 0 ? (
          <Card>
            <EmptyState icon={<BoxIcon size={24} />} title="Belum ada brand" hint="Tambah brand pertama Anda." />
          </Card>
        ) : (
          brands.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-haze text-azure grid place-items-center shrink-0">
                  <BoxIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink truncate">{b.name}</span>
                    {!b.isActive && <Badge tone="neutral">nonaktif</Badge>}
                    {b.slug && <span className="text-[11px] text-muted">/{b.slug}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <StoreIcon size={13} /> {b.outletCount} outlet
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <WalletIcon size={13} /> {b.qrisCount} QRIS
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon size={13} /> {b.agentCount} agen
                    </span>
                  </div>
                </div>
                <Button variant="soft" onClick={() => setSheet(b)} className="!py-2 !px-3 shrink-0">
                  Ubah
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <BrandSheet
        target={sheet}
        onClose={() => setSheet(null)}
        onSaved={() => {
          setSheet(null);
          setBrands(null);
          reload();
        }}
      />
    </div>
  );
}

function BrandSheet({
  target,
  onClose,
  onSaved,
}: {
  target: Brand | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = target === "new";
  const brand = target && target !== "new" ? target : null;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setErr(null);
    setName(brand?.name ?? "");
    setSlug(brand?.slug ?? "");
    setActive(brand?.isActive ?? true);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setErr("Nama brand minimal 2 karakter.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      if (isNew) {
        await owner.brands.create({ name: name.trim(), slug: slug.trim() || undefined });
      } else if (brand) {
        await owner.brands.update(brand.id, { name: name.trim(), slug: slug.trim(), isActive: active });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan brand.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={isNew ? "Brand baru" : brand?.name || "Brand"}>
      <form onSubmit={submit} className="space-y-3.5">
        <TextField label="Nama brand" value={name} onChange={(e) => setName(e.target.value)} required placeholder="mis. POCER" />
        <TextField
          label="Slug (opsional)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="mis. pocer"
          hint="Dipakai untuk URL/identitas. Huruf kecil, angka, tanda hubung."
        />
        {!isNew && (
          <label className="flex items-center justify-between rounded-2xl bg-white border border-line px-4 py-3.5">
            <span className="text-[14px] font-semibold text-ink">Brand aktif</span>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-azure" />
          </label>
        )}
        {err && <Alert tone="error">{err}</Alert>}
        <Button type="submit" fullWidth loading={loading}>
          {isNew ? "Buat brand" : "Simpan"}
        </Button>
      </form>
    </Sheet>
  );
}
