import { direction, sparklinePath } from "@/lib/market";
import { toneClass } from "./galleon";

/** 최근 주가 흐름. 처음보다 오르면 빨강, 내리면 파랑 (toneClass 와 같은 규칙). */
export function Sparkline({
  prices,
  width = 56,
  height = 24,
  className = "",
}: {
  prices: readonly number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const path = sparklinePath(prices, width, height);
  if (!path) return <span aria-hidden style={{ width, height }} className={`inline-block ${className}`} />;
  const delta = prices[prices.length - 1] - prices[0];
  const dir = direction(delta);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={dir === "up" ? "최근 상승" : dir === "down" ? "최근 하락" : "최근 보합"}
      className={`overflow-visible ${toneClass(delta)} ${className}`}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
