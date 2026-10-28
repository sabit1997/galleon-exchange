"use client";

import { useCallback, useEffect, useState } from "react";
import { useMemberSession } from "@/components/providers/session-provider";
import { Card, Empty, MeChip, PageTitle, SkeletonRows } from "@/components/ui/card";
import { Galleon } from "@/components/ui/galleon";
import type { LeaderboardRow } from "@/lib/database.types";

const REFRESH_MS = 30_000;
// 상위 3명 순위 배지 — 금·은·동
const MEDALS = [
  "bg-[radial-gradient(circle_at_35%_30%,#fff1c2,#f5c451_55%,#b9831c)] text-[#5a3d06] shadow-[0_4px_14px_-4px_rgb(245_196_81/0.7)]",
  "bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c9d1de_55%,#7d879a)] text-[#2a3140] shadow-[0_4px_14px_-4px_rgb(201_209_222/0.5)]",
  "bg-[radial-gradient(circle_at_35%_30%,#ffd9b8,#d08b4f_55%,#8a5228)] text-[#3d2410] shadow-[0_4px_14px_-4px_rgb(208_139_79/0.6)]",
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

  return (
    <div>
      <PageTitle eyebrow="투자 마법사 순위" title="명예의 전당" subtitle="총 자산 = 증권계좌 현금 + 보유 주식 평가금액. 30초마다 갱신돼요." />
      <Card className="!p-0 overflow-hidden">
        {error ? (
          <Empty>순위를 불러오지 못했어요. ({error})</Empty>
        ) : rows === null ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <Empty>아직 증권계좌를 연 사람이 없어요.</Empty>
        ) : (
          <ol className="divide-y divide-white/5">
            {rows.map((r, i) => {
              const isMe = r.discord_id === me;
              return (
                <li
                  key={r.discord_id}
                  className={`relative flex items-center gap-3 px-4 py-3.5 sm:px-5 ${isMe ? "bg-magic/[0.07]" : i === 0 ? "bg-[linear-gradient(90deg,rgb(245_196_81/0.09),transparent_60%)]" : ""}`}
                >
                  {isMe && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-magic" />}
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${
                      MEDALS[i] ?? "bg-white/[0.04] text-slate-400"
                    }`}
                    aria-label={`${i + 1}위`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className={`truncate text-[15px] ${i < 3 ? "font-bold text-slate-50" : "font-semibold text-slate-100"}`}>{r.display_name}</span>
                      {isMe && <MeChip />}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      현금 <Galleon value={r.cash} /> · 주식 <Galleon value={r.stock_value} />
                    </p>
                  </div>
                  <Galleon value={r.net_worth} className={`shrink-0 font-bold ${i === 0 ? "gilded text-lg" : "text-[15px] text-slate-50"}`} />
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
