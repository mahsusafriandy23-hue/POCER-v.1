"use client";

import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { rupiah } from "@/lib/format";

// ───────────────── Money ─────────────────
export function Money({
  value,
  className = "",
  prefix = "Rp",
}: {
  value: number | null | undefined;
  className?: string;
  prefix?: string;
}) {
  return (
    <span className={className}>
      <span className="opacity-60">{prefix} </span>
      {rupiah(value)}
    </span>
  );
}

// ───────────────── Badge ─────────────────
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warn" | "danger" | "azure";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
    azure: "bg-haze text-azure",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ───────────────── Card ─────────────────
export function Card({
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: any;
} & Record<string, any>) {
  return (
    <Tag className={`rounded-3xl bg-white border border-line ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// ───────────────── Stat card ─────────────────
export function StatCard({
  label,
  value,
  icon,
  tone = "azure",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "azure" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    azure: "text-azure bg-haze",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      {icon && <div className={`h-11 w-11 rounded-2xl grid place-items-center ${tones[tone]}`}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-muted truncate">{label}</div>
        <div className="text-[19px] font-extrabold text-ink leading-tight truncate">{value}</div>
      </div>
    </Card>
  );
}

// ───────────────── Select ─────────────────
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className = "", children, ...rest },
  ref,
) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-semibold text-ink mb-1.5">{label}</span>}
      <div className="rounded-2xl bg-white border border-line px-3 focus-within:border-azure focus-within:ring-2 focus-within:ring-azure/20 transition-all">
        <select
          ref={ref}
          className={`w-full bg-transparent py-3.5 text-[15px] text-ink outline-none ${className}`}
          {...rest}
        >
          {children}
        </select>
      </div>
    </label>
  );
});

// ───────────────── Switch ─────────────────
export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-azure" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

// ───────────────── Empty state ─────────────────
export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="text-center py-12 px-6">
      {icon && <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-haze text-azure grid place-items-center">{icon}</div>}
      <div className="font-bold text-ink">{title}</div>
      {hint && <div className="text-[13px] text-muted mt-1">{hint}</div>}
    </div>
  );
}

// ───────────────── Section header ─────────────────
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[15px] font-extrabold text-ink">{children}</h2>
      {action}
    </div>
  );
}

// ───────────────── Skeleton ─────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />;
}
