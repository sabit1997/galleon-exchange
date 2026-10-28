"use client";

import { useNow } from "@/hooks/use-now";
import { HelpTip } from "./help-tip";

/** VI 가 풀리기까지 남은 초. 발동 중이 아니면 0 */
export function useViRemaining(viUntil: string | null): number {
  const now = useNow(1000);
  if (!viUntil) return 0;
  const end = Date.parse(viUntil);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

export function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** VI 발동 배지 + 카운트다운. 발동 중이 아니면 아무것도 그리지 않는다. */
export function ViBadge({ viUntil }: { viUntil: string | null }) {
  const left = useViRemaining(viUntil);
  if (left <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 ring-1 ring-inset ring-amber-400/30">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
      VI 발동 <span className="tabular-nums">{formatCountdown(left)}</span>
      <HelpTip term="VI" />
    </span>
  );
}
