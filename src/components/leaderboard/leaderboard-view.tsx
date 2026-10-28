"use client";

import { useCallback, useEffect, useState } from "react";
import { useMemberSession } from "@/components/providers/session-provider";
import { Card, Empty, PageTitle, Spinner } from "@/components/ui/card";
import { Galleon } from "@/components/ui/galleon";
import type { LeaderboardRow } from "@/lib/database.types";

const REFRESH_MS = 30_000;
const MEDALS = ["🥇", "🥈", "🥉"];

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
      <PageTitle title="🏆 투자 마법사 순위" subtitle="총 자산 = 증권계좌 현금 + 보유 주식 평가금액. 30초마다 갱신돼요." />
      <Card className="!p-0 overflow-hidden">
        {error ? (
          <Empty>순위를 불러오지 못했어요. ({error})</Empty>
        ) : rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>아직 증권계좌를 연 사람이 없어요.</Empty>
        ) : (
          <ol className="divide-y divide-white/5">
            {rows.map((r, i) => (
              <li key={r.discord_id} className={`flex items-center gap-3 px-4 py-3 ${r.discord_id === me ? "bg-gold/[0.07]" : ""}`}>
                <span className="w-8 shrink-0 text-center text-lg tabular-nums text-slate-400">{MEDALS[i] ?? i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.display_name}
                    {r.discord_id === me && <span className="ml-2 rounded bg-gold/15 px-1.5 text-[11px] text-gold">나</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    현금 <Galleon value={r.cash} /> · 주식 <Galleon value={r.stock_value} />
                  </p>
                </div>
                <Galleon value={r.net_worth} className="font-semibold text-gold" />
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
