/** Compact azure header for inner pages. */
export default function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="bg-hero relative px-5 pt-8 pb-7 text-white">
      <div className="hero-glow absolute inset-0" aria-hidden />
      <div className="relative">
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-white/85 text-[13px] mt-0.5">{subtitle}</p>}
      </div>
    </header>
  );
}
