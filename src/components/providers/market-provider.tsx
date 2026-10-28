"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EventEffect, MarketConfig, Stock } from "@/lib/database.types";
import { direction, type Direction } from "@/lib/market";
import { useMemberSession } from "./session-provider";

export type LiveStock = Stock & {
  /** 마지막 실시간 변동 방향 — 깜빡임 표시용 */
  flash: Direction;
  /** 변동마다 증가. key 로 써서 애니메이션을 다시 재생한다 */
  flashKey: number;
};

type MarketContextValue = {
  loading: boolean;
  error: string | null;
  config: MarketConfig | null;
  effects: Map<string, EventEffect>;
  stocks: Map<string, LiveStock>;
  /** discord_id → 표시 이름 (상장 안 된 사람은 없음) */
  nameOf: (discordId: string) => string;
  reload: () => void;
};

const MarketContext = createContext<MarketContextValue | null>(null);

const toLive = (s: Stock, prev?: LiveStock): LiveStock => {
  if (!prev) return { ...s, flash: "flat", flashKey: 0 };
  const d = direction(s.price - prev.price);
  return d === "flat" ? { ...s, flash: prev.flash, flashKey: prev.flashKey } : { ...s, flash: d, flashKey: prev.flashKey + 1 };
};

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const { supabase, guildId } = useMemberSession();
  const [config, setConfig] = useState<MarketConfig | null>(null);
  const [effects, setEffects] = useState<Map<string, EventEffect>>(new Map());
  const [stocks, setStocks] = useState<Map<string, LiveStock>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const loadStocks = useCallback(async () => {
    const { data, error: err } = await supabase.from("stocks").select("*").eq("guild_id", guildId);
    if (err) {
      setError(err.message);
      return;
    }
    setStocks((prev) => new Map(data.map((s) => [s.discord_id, toLive(s, prev.get(s.discord_id))])));
  }, [supabase, guildId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cfgRes, effRes] = await Promise.all([
        supabase.from("market_config").select("*").maybeSingle(),
        supabase.from("event_effects").select("*"),
      ]);
      if (cancelled) return;
      if (cfgRes.error || effRes.error) setError((cfgRes.error ?? effRes.error)?.message ?? null);
      setConfig(cfgRes.data ?? null);
      setEffects(new Map((effRes.data ?? []).map((e) => [e.type, e])));
      await loadStocks();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, loadStocks, version]);

  // 주가 실시간 반영. (재)연결될 때마다 전체를 다시 읽어 놓친 변경을 메운다.
  useEffect(() => {
    let first = true;
    const channel = supabase
      .channel(`stocks:${guildId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stocks", filter: `guild_id=eq.${guildId}` },
        (payload) => {
          setStocks((prev) => {
            const next = new Map(prev);
            if (payload.eventType === "DELETE") {
              const old = payload.old as Partial<Stock>;
              if (old.discord_id) next.delete(old.discord_id);
            } else {
              const row = payload.new as Stock;
              next.set(row.discord_id, toLive(row, prev.get(row.discord_id)));
            }
            return next;
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (!first) void loadStocks();
          first = false;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId, loadStocks]);

  const nameOf = useCallback((id: string) => stocks.get(id)?.display_name ?? "익명의 마법사", [stocks]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ loading, error, config, effects, stocks, nameOf, reload }),
    [loading, error, config, effects, stocks, nameOf, reload],
  );
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket 은 MarketProvider 안에서만 쓸 수 있어요");
  return ctx;
}
