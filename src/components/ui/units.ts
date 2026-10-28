import { formatGalleon } from "@/lib/format";

/** 큰 금액을 한국식 단위로: 12,345,678 → 1,235만 · 320,000,000 → 3.2억 */
export function koUnit(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(abs >= 1e13 ? 0 : 1)}조`;
  if (abs >= 1e8) return `${(n / 1e8).toFixed(abs >= 1e10 ? 0 : 1)}억`;
  if (abs >= 1e4) return `${formatGalleon(Math.round(n / 1e4))}만`;
  return formatGalleon(n);
}
