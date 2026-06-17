import type { ReactNode } from "react";

/** Branded hero header shared by login & register. */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-hero relative px-6 pt-12 pb-16 text-white overflow-hidden">
        <div className="hero-glow absolute inset-0" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur grid place-items-center font-extrabold text-xl">
              P
            </div>
            <span className="text-xl font-extrabold tracking-tight">POCER</span>
          </div>
          <h1 className="mt-7 text-[26px] leading-tight font-extrabold">{title}</h1>
          <p className="mt-1 text-white/85 text-[14px]">{subtitle}</p>
        </div>
      </header>

      <main className="flex-1 px-6 -mt-8 pb-10 relative">
        <div className="rounded-4xl bg-white p-6 shadow-soft">{children}</div>
      </main>
    </div>
  );
}
