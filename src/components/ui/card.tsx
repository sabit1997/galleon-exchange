export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel rounded-3xl p-5 ${className}`}>{children}</section>;
}

export function PageTitle({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <header className="mb-6 animate-fade-up">
      {eyebrow && <p className="mb-1.5 text-xs font-semibold tracking-wide text-magic">{eyebrow}</p>}
      <h1 className="text-[1.75rem] font-bold leading-tight text-slate-50 sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>}
    </header>
  );
}

/** 카드 안 작은 제목 */
export function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-[15px] font-semibold text-slate-100 ${className}`}>{children}</h2>;
}

export function Spinner({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-slate-400" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-magic/25 border-t-magic" />
      {label}
    </div>
  );
}

/** 목록 로딩용 스켈레톤 줄 */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-white/5" role="status" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-4">
          <span className="skeleton h-10 w-10 shrink-0 !rounded-full" />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-3.5 w-28" />
            <span className="skeleton block h-3 w-16" />
          </span>
          <span className="space-y-2 text-right">
            <span className="skeleton ml-auto block h-3.5 w-20" />
            <span className="skeleton ml-auto block h-3 w-12" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-12 text-center text-sm text-slate-500">{children}</p>;
}

/** "나" 표시 칩 */
export function MeChip() {
  return <span className="shrink-0 rounded-md bg-magic/15 px-1.5 py-px text-[11px] font-semibold text-magic-bright">나</span>;
}
