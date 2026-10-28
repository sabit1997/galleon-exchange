import { formatGalleon, formatPct, formatPrice } from "@/lib/format";
import { direction } from "@/lib/market";

/** 갈레온 금액 표시. price 면 소수 둘째 자리까지 */
export function Galleon({ value, price = false, className = "" }: { value: number; price?: boolean; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`}>
      {price ? formatPrice(value) : formatGalleon(value)}
      <span className="ml-0.5 text-[0.8em]" aria-label="갈레온">
        🪙
      </span>
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
