"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { SpinnerIcon } from "./icons";

// ───────────────── Button ─────────────────

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "ghost";
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-azure text-white shadow-qa hover:bg-azure-400 active:scale-[.98]",
    soft: "bg-haze text-azure hover:bg-[#dfe9ff] active:scale-[.98]",
    ghost: "bg-transparent text-azure hover:bg-haze",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-bold py-3.5 px-5 text-[15px] transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none ${
        variants[variant]
      } ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <SpinnerIcon size={18} />}
      {children}
    </button>
  );
}

// ───────────────── Text field ─────────────────

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, hint, prefix, suffix, className = "", ...rest },
  ref,
) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-ink mb-1.5">{label}</span>
      <div className="flex items-center gap-2 rounded-2xl bg-white border border-line px-4 focus-within:border-azure focus-within:ring-2 focus-within:ring-azure/20 transition-all">
        {prefix && <span className="text-muted text-[15px] font-semibold shrink-0">{prefix}</span>}
        <input
          ref={ref}
          className={`flex-1 bg-transparent py-3.5 text-[15px] text-ink placeholder:text-dim outline-none ${className}`}
          {...rest}
        />
        {suffix}
      </div>
      {hint && <span className="block text-[12px] text-muted mt-1.5">{hint}</span>}
    </label>
  );
});

// ───────────────── Alert (inline error/info) ─────────────────

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: ReactNode }) {
  const tones: Record<string, string> = {
    error: "bg-rose-50 text-rose-700 border-rose-100",
    info: "bg-haze text-azure border-line",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 text-[13px] font-medium ${tones[tone]}`}>{children}</div>
  );
}
