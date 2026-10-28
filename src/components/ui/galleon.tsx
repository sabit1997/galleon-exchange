import { formatGalleon, formatPct, formatPrice } from "@/lib/format";
import { direction } from "@/lib/market";

/** 갈레온 금액 표시. price 면 소수 둘째 자리까지 */
export function Galleon({ value, price = false, className = "" }: { value: number; price?: boolean; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`}>
      {price ? formatPrice(value) : formatGalleon(value)}
      <GalleonCoin />
    </span>
  );
}

/** 작은 금화 표시 (갈레온 단위) */
export function GalleonCoin({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="갈레온"
      className={`ml-[0.25em] inline-grid h-[0.9em] w-[0.9em] translate-y-[0.08em] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff1c2,#f5c451_55%,#b9831c)] align-baseline text-[0.55em] font-black leading-none text-[#6b4a0c] shadow-[inset_0_-1px_0_rgb(0_0_0/0.2)] ${className}`}
    >
      G
    </span>
  );
}

/** 한국식 등락 색 — 상승 빨강, 하락 파랑 */
export function toneClass(delta: number): string {
  const d = direction(delta);
  if (d === "up") return "text-rise";
  if (d === "down") return "text-fall";
  return "text-slate-400";
}

export function ChangePct({ ratio, className = "" }: { ratio: number; className?: string }) {
  const d = direction(ratio);
  const arrow = d === "up" ? "▲" : d === "down" ? "▼" : "";
  return (
    <span className={`tabular-nums ${toneClass(ratio)} ${className}`}>
      {arrow && <span className="mr-0.5 text-[0.75em]">{arrow}</span>}
      {formatPct(ratio)}
    </span>
  );
}
