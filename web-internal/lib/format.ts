/** Rupiah formatting + duration/date humanizers (id-ID). */

export function rupiah(n: number | null | undefined): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID").format(Math.round(v));
}

/** Split a rupiah amount into "Rp" + grouped number for the big balance display. */
export function rupiahParts(n: number | null | undefined): { symbol: string; value: string } {
  return { symbol: "Rp", value: rupiah(n) };
}

/** "1h" → "1 jam", "2d" → "2 hari", "30d" → "30 hari", "90m" → "90 menit". */
export function humanDuration(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = /^(\d+)\s*([a-zA-Z]+)$/.exec(raw.trim());
  if (!m) return raw;
  const qty = m[1];
  const unit = m[2].toLowerCase();
  const map: Record<string, string> = {
    m: "menit", min: "menit", menit: "menit",
    h: "jam", hr: "jam", jam: "jam", j: "jam",
    d: "hari", day: "hari", hari: "hari",
    w: "minggu", minggu: "minggu",
    mo: "bulan", month: "bulan", bulan: "bulan",
  };
  return `${qty} ${map[unit] ?? unit}`;
}

const DTF = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return DTF.format(d);
}

const DAY_FMT = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return DAY_FMT.format(d);
}

/** Time left until an expiry timestamp, humanized in Indonesian. */
export function remaining(expiryIso: string | null | undefined): {
  expired: boolean;
  label: string;
  ms: number;
} {
  if (!expiryIso) return { expired: true, label: "-", ms: 0 };
  const ms = new Date(expiryIso).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return { expired: true, label: "Kedaluwarsa", ms: 0 };
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  let label: string;
  if (d > 0) label = `${d} hari ${h} jam`;
  else if (h > 0) label = `${h} jam ${m} menit`;
  else {
    const s = Math.floor((ms % 60000) / 1000);
    label = `${m} menit ${s} detik`;
  }
  return { expired: false, label, ms };
}

/** Fraction of the validity window already elapsed (0..1). */
export function elapsedFraction(
  createdIso: string | null | undefined,
  expiryIso: string | null | undefined,
): number {
  if (!createdIso || !expiryIso) return 0;
  const start = new Date(createdIso).getTime();
  const end = new Date(expiryIso).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  const f = (Date.now() - start) / (end - start);
  return Math.min(1, Math.max(0, f));
}

/** Greeting by local hour, e.g. "Selamat pagi". */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

/** Initial letter for the avatar bubble. */
export function initial(name: string | null | undefined, phone?: string | null): string {
  const src = (name && name.trim()) || phone || "";
  return src.trim().charAt(0).toUpperCase() || "M";
}
