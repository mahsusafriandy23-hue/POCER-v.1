"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { MapPinIcon, ChevronDownIcon, CheckIcon } from "./icons";
import type { ServerLocation } from "@/lib/api";

/**
 * Outlet/location selector styled after super-app store pickers: a tappable
 * card showing the chosen outlet, opening a sheet to switch.
 */
export default function OutletPicker({
  servers,
  activeId,
  onChange,
}: {
  servers: ServerLocation[];
  activeId: number | null;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = servers.find((s) => s.id === activeId) ?? null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl bg-white p-3.5 shadow-soft flex items-center gap-3 text-left active:scale-[.99] transition-transform"
      >
        <span className="w-10 h-10 rounded-xl bg-haze text-azure grid place-items-center shrink-0">
          <MapPinIcon size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] text-muted font-medium">Lokasi outlet</span>
          <span className="block font-extrabold text-ink uppercase truncate">
            {active ? active.name : "Pilih lokasi"}
          </span>
        </span>
        <span className="w-8 h-8 rounded-full bg-haze text-azure grid place-items-center shrink-0">
          <ChevronDownIcon size={18} />
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Pilih lokasi outlet">
        <div className="space-y-2">
          {servers.map((s) => {
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
                className={`w-full rounded-2xl p-4 flex items-center gap-3 text-left transition-all ${
                  isActive ? "bg-haze ring-2 ring-azure/30" : "bg-white border border-line hover:border-azure"
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
                    isActive ? "bg-azure text-white" : "bg-haze text-azure"
                  }`}
                >
                  <MapPinIcon size={18} />
                </span>
                <span className="flex-1 font-bold text-ink uppercase">{s.name}</span>
                {isActive && <CheckIcon size={20} className="text-azure shrink-0" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
