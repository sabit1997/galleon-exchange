import Link from "next/link";

export type TagTone = "rise" | "fall" | "gold" | "magic" | "warn" | "danger" | "neutral" | "sky";

const TONES: Record<TagTone, string> = {
  rise: "bg-rise/12 text-rise ring-rise/25",
  fall: "bg-fall/12 text-fall ring-fall/25",
  gold: "bg-gold/10 text-gold-bright ring-gold/25",
  magic: "bg-magic/12 text-magic-bright ring-magic/25",
  warn: "bg-[#f59e0b]/12 text-[#fbbf24] ring-[#f59e0b]/30",
  danger: "bg-rise-deep text-white ring-rise-deep",
  neutral: "bg-white/6 text-slate-300 ring-white/10",
  sky: "bg-sky/10 text-sky ring-sky/25",
};

/** 작은 네모 태그 (증권 앱의 상한가 · 신용 · 지정가 같은 표시) */
export function Tag({ tone = "neutral", children, className = "", title }: { tone?: TagTone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold leading-[1.45] ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** 용어 사전으로 가는 작은 링크. 처음 보는 용어 옆에 붙인다. */
export function TermLink({ id, children, className = "" }: { id: string; children?: React.ReactNode; className?: string }) {
  return (
    <Link
      href={`/learn#t-${id}`}
      className={`inline-flex items-center gap-0.5 text-slate-500 underline decoration-dotted decoration-slate-600 underline-offset-[3px] hover:text-magic-bright hover:decoration-magic-bright ${className}`}
      title="주식 공부 · 용어 사전에서 보기"
    >
      {children ?? (
        <span aria-label="용어 설명" className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[9px] font-bold no-underline">
          ?
        </span>
      )}
    </Link>
  );
}

/** 초보자용 한 줄 설명 상자 */
export function LearnHint({ children, term, className = "" }: { children: React.ReactNode; term?: string; className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-xl bg-magic/[0.06] px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-300 ring-1 ring-inset ring-magic/15 ${className}`}>
      <span aria-hidden className="mt-px shrink-0 text-[13px]">
        📖
      </span>
      <span className="min-w-0">
        {children}
        {term && (
          <>
            {" "}
            <TermLink id={term}>자세히</TermLink>
          </>
        )}
      </span>
    </p>
  );
}
