import { Flourish } from "./ornament";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel rounded-2xl p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h1 className="font-display gilded text-2xl font-bold sm:text-3xl">{title}</h1>
      <Flourish className="mt-1.5" />
      {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
    </header>
  );
}

export function Spinner({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
      {label}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-slate-500">{children}</p>;
}
