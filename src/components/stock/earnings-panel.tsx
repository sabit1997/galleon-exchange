"use client";

import { ChangePct } from "@/components/ui/galleon";
import type { Earning } from "@/lib/database.types";
import { formatPct, formatPrice } from "@/lib/format";
import { HelpTip, Term } from "./help-tip";

const fmtMin = (m: number | null) => (m === null ? "-" : m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);
const weekLabel = (day: string) => {
  const [, mm, dd] = day.split("-");
  return `${Number(mm)}/${Number(dd)}주`;
};

function verdict(surprise: number | null): { text: string; cls: string } {
  if (surprise === null) return { text: "-", cls: "text-slate-500" };
  if (surprise >= 0.1) return { text: "서프라이즈", cls: "bg-rise/15 text-rise" };
  if (surprise <= -0.1) return { text: "쇼크", cls: "bg-fall/15 text-fall" };
  return { text: "부합", cls: "bg-white/8 text-slate-300" };
}

/** 주간 실적(공부시간): 이번 주 컨센서스 + 지난 발표 기록 (예상 vs 실제) */
export function EarningsPanel({ earnings }: { earnings: Earning[] | null }) {
  if (earnings === null) return <div className="skeleton h-32" role="status" aria-label="실적 불러오는 중" />;

  const upcoming = earnings.find((e) => e.actual === null) ?? null;
  const history = earnings.filter((e) => e.actual !== null);
  const maxMin = Math.max(1, ...history.flatMap((e) => [e.actual ?? 0, e.consensus ?? 0]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-inset ring-white/5">
        <div className="text-xs text-slate-400">
          <Term k="컨센서스">이번 주 컨센서스</Term>
          <p className="mt-0.5 text-base font-bold tabular-nums text-slate-50">{upcoming ? fmtMin(upcoming.consensus) : "-"}</p>
        </div>
        <p className="max-w-[16rem] text-[11px] leading-relaxed text-slate-500">
          매주 월요일 0시 지난주 실제 공부시간이 발표돼요. 예상보다 10% 넘게 많으면 어닝 서프라이즈, 적으면 어닝 쇼크.{" "}
          <HelpTip term="실적" />
        </p>
      </div>

      {history.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">아직 발표된 실적이 없어요.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-xs tabular-nums">
            <thead>
              <tr className="text-[11px] text-slate-500">
                <th className="px-1 py-1 text-left font-normal">주</th>
                <th className="px-1 py-1 text-left font-normal">예상 vs 실제</th>
                <th className="px-1 py-1 text-right font-normal">서프라이즈</th>
                <th className="px-1 py-1 text-right font-normal">주가 영향</th>
                <th className="px-1 py-1 text-right font-normal">
                  <Term k="배당">배당</Term>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {history.map((e) => {
                const v = verdict(e.surprise);
                return (
                  <tr key={e.week_start}>
                    <td className="whitespace-nowrap px-1 py-1.5 text-slate-400">{weekLabel(e.week_start)}</td>
                    <td className="px-1 py-1.5">
                      <div className="space-y-0.5">
                        <Bar value={e.consensus ?? 0} max={maxMin} cls="bg-slate-500/60" label={`예상 ${fmtMin(e.consensus)}`} />
                        <Bar
                          value={e.actual ?? 0}
                          max={maxMin}
                          cls={(e.surprise ?? 0) >= 0 ? "bg-rise/70" : "bg-fall/70"}
                          label={`실제 ${fmtMin(e.actual)}`}
                        />
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-right">
                      <span className={`rounded px-1 py-px text-[10px] font-bold ${v.cls}`}>{v.text}</span>
                      <span className="block text-[10px] text-slate-500">{e.surprise === null ? "" : formatPct(e.surprise, 0)}</span>
                    </td>
                    <td className="px-1 py-1.5 text-right">
                      {e.price_effect === null ? "-" : <ChangePct ratio={e.price_effect} />}
                    </td>
                    <td className="px-1 py-1.5 text-right text-gold">{e.dps ? formatPrice(e.dps) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Bar({ value, max, cls, label }: { value: number; max: number; cls: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/[0.05] sm:w-24">
        <i className={`block h-full rounded-full ${cls}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </span>
      <span className="whitespace-nowrap text-[10px] text-slate-400">{label}</span>
    </div>
  );
}
