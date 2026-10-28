"use client";

import { useCallback, useEffect, useState } from "react";
import { useMemberSession } from "@/components/providers/session-provider";
import { Empty, MeChip, PageTitle, SkeletonRows } from "@/components/ui/card";
import { Galleon } from "@/components/ui/galleon";
import { LearnHint } from "@/components/ui/tag";
import { koUnit } from "@/components/ui/units";
import type { LeaderboardRow } from "@/lib/database.types";
import { formatGalleon } from "@/lib/format";

const REFRESH_MS = 30_000;
// 상위 3명 순위 배지 — 금·은·동
const MEDALS = [
  "bg-[radial-gradient(circle_at_35%_30%,#fff1c2,#f5c451_55%,#b9831c)] text-[#5a3d06]",
  "bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c9d1de_55%,#7d879a)] text-[#2a3140]",
  "bg-[radial-gradient(circle_at_35%_30%,#ffd9b8,#d08b4f_55%,#8a5228)] text-[#3d2410]",
];

export function LeaderboardView() {
  const { supabase, guildId, me } = useMemberSession();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("leaderboard", { p_guild: guildId });
    if (err) setError(err.message);
    else {
      setError(null);
      setRows(data ?? []);
    }
  }, [supabase, guildId]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const myIndex = rows ? rows.findIndex((r) => r.discord_id === me) : -1;
  const mine = myIndex >= 0 && rows ? rows[myIndex] : null;
  const leader = rows?.[0] ?? null;

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="투자 마법사 순위" title="명예의 전당" subtitle="순자산 순위예요. 30초마다 갱신돼요." />

      {mine && rows && (
        <section className="panel-glow grid grid-cols-3 gap-3 rounded-2xl p-4 sm:p-5" aria-label="내 순위">
          <div>
            <p className="text-[11.5px] text-slate-400">내 순위</p>
            <p className="mt-0.5 text-[22px] font-extrabold text-slate-50 tabular-nums">
              {myIndex + 1}
              <span className="text-[13px] font-medium text-slate-500">/{rows.length}위</span>
            </p>
          </div>
          <div>
            <p className="text-[11.5px] text-slate-400">내 순자산</p>
            <Galleon value={mine.net_worth} className="gilded mt-1 block truncate text-[17px] font-bold" />
          </div>
          <div>
            <p className="text-[11.5px] text-slate-400">{myIndex === 0 ? "2위와 차이" : "1위까지"}</p>
            <p className="mt-1 truncate text-[15px] font-semibold text-slate-200 tabular-nums">
              {myIndex === 0 ? (rows[1] ? `+${koUnit(mine.net_worth - rows[1].net_worth)}` : "-") : leader ? koUnit(leader.net_worth - mine.net_worth) : "-"}
            </p>
          </div>
        </section>
      )}

      <section className="sheet overflow-hidden rounded-2xl">
        {error ? (
          <Empty>순위를 불러오지 못했어요. ({error})</Empty>
        ) : rows === null ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <Empty>아직 증권계좌를 연 사람이 없어요.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="!pl-4 sm:!pl-5">
                    순위 · 이름
                  </th>
                  <th scope="col">순자산</th>
                  <th scope="col" className="hidden sm:table-cell">
                    현금
                  </th>
                  <th scope="col" className="hidden sm:table-cell">
                    투자자산
                  </th>
                  <th scope="col" className="!pr-4 sm:!pr-5">
                    투자 비중
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isMe = r.discord_id === me;
                  const weight = r.net_worth > 0 ? Math.max(0, Math.min(1, r.stock_value / r.net_worth)) : 0;
                  return (
                    <tr key={r.discord_id} className={isMe ? "bg-magic/[0.08]" : ""}>
                      <td className="!pl-4 sm:!pl-5">
                        <div className="flex min-w-0 max-w-[170px] items-center gap-2.5 font-sans sm:max-w-[260px]">
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold tabular-nums ${
                              MEDALS[i] ?? "text-slate-400"
                            }`}
                            aria-label={`${i + 1}위`}
                          >
                            {i + 1}
                          </span>
                          <span className={`truncate text-[14px] ${i < 3 ? "font-bold text-slate-50" : "font-semibold text-slate-200"}`}>{r.display_name}</span>
                          {isMe && <MeChip />}
                        </div>
                      </td>
                      <td>
                        <Galleon value={r.net_worth} className={`font-bold ${i === 0 ? "gilded text-[15px]" : "text-[14px] text-slate-50"}`} />
                      </td>
                      <td className="hidden text-slate-300 sm:table-cell">{formatGalleon(r.cash)}</td>
                      <td className="hidden text-slate-300 sm:table-cell">{formatGalleon(r.stock_value)}</td>
                      <td className="!pr-4 sm:!pr-5">
                        <div className="ml-auto flex w-[74px] items-center gap-1.5 sm:w-[110px]">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8" aria-hidden>
                            <span className="block h-full rounded-full bg-magic" style={{ width: `${weight * 100}%` }} />
                          </span>
                          <span className="w-8 text-right text-[11.5px] text-slate-400">{Math.round(weight * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LearnHint term="diversify">
        순자산 = 주문가능 현금 + 주문에 묶인 갈레온 + 보유 주식 평가금액 + 신용(평가금액 − 대출금) + 공매도(담보 − 되사는 비용). 디스코드에서 입금한 원금이 모두 달라서, 순위는 수익률이 아니라
        순자산 기준이에요. 투자 비중이 100%에 가까울수록 시장이 흔들릴 때 함께 크게 흔들려요.
      </LearnHint>
    </div>
  );
}
