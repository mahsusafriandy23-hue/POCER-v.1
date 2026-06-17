"use client";

import { useEffect, useState } from "react";
import { agent, type AgentPkg, type AgentProfile, type Outlet, ApiError } from "@/lib/api";
import { rupiah, humanDuration } from "@/lib/format";
import { PageTitle } from "@/components/AppShell";
import { Card, Badge, EmptyState, Skeleton } from "@/components/kit";
import { Alert } from "@/components/ui";
import { StoreIcon, TagIcon, CheckIcon } from "@/components/icons";

/** Parse a rupiah text input into a non-negative integer. */
function parseAmount(s: string): number {
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export default function HargaPage() {
  const [me, setMe] = useState<AgentProfile | null>(null);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [packages, setPackages] = useState<AgentPkg[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    setPackages(null);
    setErr(null);
    try {
      const pkgs = await agent.packages(o.id);
      setPackages(pkgs);
      setDrafts(Object.fromEntries(pkgs.map((p) => [p.id, String(p.sellPrice)])));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal memuat paket.");
    }
  }

  async function save(p: AgentPkg) {
    const next = parseAmount(drafts[p.id] ?? "");
    setErr(null);
    if (next < p.agentPrice) {
      setErr(`Harga jual "${p.name}" tidak boleh di bawah modal (Rp${rupiah(p.agentPrice)}).`);
      return;
    }
    setSavingId(p.id);
    try {
      const res = await agent.setSellPrice(p.id, next);
      setPackages((prev) =>
        prev
          ? prev.map((x) =>
              x.id === p.id
                ? { ...x, sellPrice: res.sellPrice, margin: res.margin, customSellPrice: true }
                : x,
            )
          : prev,
      );
      setSavedId(p.id);
      setTimeout(() => setSavedId((id) => (id === p.id ? null : id)), 1800);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan harga.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <PageTitle
        title="Harga jual"
        subtitle="Atur harga jual Anda ke pelanggan. Untung = harga jual − modal."
      />

      {err && (
        <div className="mb-3">
          <Alert tone="error">{err}</Alert>
        </div>
      )}

      {/* Outlet picker */}
      {!me ? (
        <Skeleton className="h-12" />
      ) : me.outlets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StoreIcon size={24} />}
            title="Belum ada outlet"
            hint="Hubungi pemilik untuk ditetapkan outlet."
          />
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {me.outlets.map((o) => (
            <button
              key={o.id}
              onClick={() => selectOutlet(o)}
              className={`rounded-xl px-4 py-2.5 text-[14px] font-bold border transition-colors flex items-center gap-1.5 ${
                outlet?.id === o.id ? "bg-azure text-[#0A0A0F] border-azure" : "bg-surface text-muted border-line hover:border-azure/40"
              }`}
            >
              <StoreIcon size={16} /> {o.name}
            </button>
          ))}
        </div>
      )}

      {/* Package price editors */}
      {outlet && (
        <div className="mt-5 space-y-3">
          {!packages ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : packages.length === 0 ? (
            <Card>
              <EmptyState icon={<TagIcon size={24} />} title="Belum ada paket aktif" />
            </Card>
          ) : (
            packages.map((p) => {
              const draft = drafts[p.id] ?? "";
              const val = parseAmount(draft);
              const liveMargin = val - p.agentPrice;
              const belowCost = val < p.agentPrice;
              const changed = val !== p.sellPrice;
              const isSaving = savingId === p.id;
              const justSaved = savedId === p.id;
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{p.name}</span>
                    <Badge tone="neutral">{humanDuration(p.duration)}</Badge>
                    {p.customSellPrice && (
                      <Badge tone="azure">
                        <TagIcon size={12} /> Custom
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 text-[12px] text-muted">
                    Modal Anda: <span className="font-semibold text-ink">Rp{rupiah(p.agentPrice)}</span>
                  </div>

                  {/* Sell price input */}
                  <label className="block mt-3 text-[12px] font-semibold text-muted">Harga jual ke pelanggan</label>
                  <div
                    className={`mt-1 flex items-center gap-2 rounded-2xl border bg-[#1A1A25] px-3.5 py-2.5 transition-colors ${
                      belowCost ? "border-rose-800" : "border-line focus-within:border-azure focus-within:ring-1 focus-within:ring-azure/30"
                    }`}
                  >
                    <span className="text-muted text-[15px] font-semibold shrink-0">Rp</span>
                    <input
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value.replace(/[^\d]/g, "") }))}
                      inputMode="numeric"
                      placeholder={String(p.price)}
                      className="w-full bg-transparent outline-none text-ink font-bold text-[17px]"
                    />
                  </div>

                  {/* Margin + save */}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[13px]">
                      {belowCost ? (
                        <span className="text-rose-600 font-semibold">Di bawah modal</span>
                      ) : (
                        <span className="text-muted">
                          Untung{" "}
                          <span className={`font-extrabold ${liveMargin > 0 ? "text-emerald-600" : "text-ink"}`}>
                            Rp{rupiah(liveMargin)}
                          </span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => save(p)}
                      disabled={isSaving || belowCost || (!changed && !justSaved)}
                      className={`rounded-xl px-4 py-2 text-[13px] font-bold transition-colors flex items-center gap-1.5 ${
                        justSaved
                          ? "bg-emerald-900/50 text-emerald-400"
                          : changed && !belowCost
                            ? "bg-azure text-[#0A0A0F] active:scale-[.98]"
                            : "bg-haze text-dim"
                      } disabled:opacity-60`}
                    >
                      {isSaving ? (
                        "Menyimpan…"
                      ) : justSaved ? (
                        <>
                          <CheckIcon size={15} strokeWidth={3} /> Tersimpan
                        </>
                      ) : (
                        "Simpan"
                      )}
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
