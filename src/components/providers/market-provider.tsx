"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EventEffect, MarketConfig, MarketIndex, Stock } from "@/lib/database.types";
import { appendSpark, direction, SPARK_POINTS, type Direction } from "@/lib/market";
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
  /** discord_id → 최근 주가 (오래된 것부터 · 목록 스파크라인용) */
  sparks: Map<string, number[]>;
  /** scope('all' · 기숙사) → 지수 제수 · 시가 */
  indices: Map<string, MarketIndex>;
  /** 지금 지수 값. 주가 합 / 제수 — 주가가 실시간이라 지수도 실시간이다 */
  indexValue: (scope: string) => number | null;
  /** discord_id → 표시 이름 (종목 이름 → 계좌 이름(서버 닉네임) → 익명) */
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
  // 종목이 없는 계좌 주인(기숙사 미배정 · 사감)의 서버 닉네임. 매매 소식 이름표용.
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [sparks, setSparks] = useState<Map<string, number[]>>(new Map());
  const [indices, setIndices] = useState<Map<string, MarketIndex>>(new Map());

  // 종목별 최근 틱으로 미니 그래프를 채운다. 이후엔 stocks 실시간 변경으로 이어 붙인다.
  const loadSparks = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("recent_prices", { p_guild: guildId, p_points: SPARK_POINTS });
    if (err) return;
    const next = new Map<string, number[]>();
    for (const t of data) {
      next.set(t.discord_id, appendSpark(next.get(t.discord_id) ?? [], t.price, SPARK_POINTS));
    }
    setSparks(next);
  }, [supabase, guildId]);

  const loadStocks = useCallback(async () => {
    const { data, error: err } = await supabase.from("stocks").select("*").eq("guild_id", guildId);
    if (err) {
      setError(err.message);
      return;
    }
    setStocks((prev) => new Map(data.map((s) => [s.discord_id, toLive(s, prev.get(s.discord_id))])));
  }, [supabase, guildId]);

  const loadIndices = useCallback(async () => {
    const { data, error: err } = await supabase.from("market_indices").select("*").eq("guild_id", guildId);
    if (!err) setIndices(new Map(data.map((i) => [i.scope, i])));
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
      await Promise.all([loadStocks(), loadSparks(), loadIndices()]);
      const namesRes = await supabase.rpc("account_names", { p_guild: guildId });
      if (cancelled) return;
      if (!namesRes.error) setAccountNames(new Map(namesRes.data.map((r) => [r.discord_id, r.display_name])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, guildId, loadStocks, loadSparks, loadIndices, version]);

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
          if (payload.eventType !== "DELETE") {
            const row = payload.new as Stock;
            setSparks((prev) => new Map(prev).set(row.discord_id, appendSpark(prev.get(row.discord_id) ?? [], row.price)));
          }
        },
      )
      // 지수 제수는 상장 · 자정에만 바뀐다
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_indices", filter: `guild_id=eq.${guildId}` },
        () => void loadIndices(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (!first) void Promise.all([loadStocks(), loadIndices()]);
          first = false;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId, loadStocks, loadIndices]);

  const nameOf = useCallback(
    (id: string) => stocks.get(id)?.display_name ?? accountNames.get(id) ?? "익명의 마법사",
    [stocks, accountNames],
  );
  const indexValue = useCallback(
    (scope: string) => {
      const idx = indices.get(scope);
      if (!idx || !idx.divisor) return null;
      let sum = 0;
      for (const s of stocks.values()) if (scope === "all" || s.house === scope) sum += s.price;
      return Math.round((sum / idx.divisor) * 100) / 100;
    },
    [indices, stocks],
  );
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ loading, error, config, effects, stocks, sparks, indices, indexValue, nameOf, reload }),
    [loading, error, config, effects, stocks, sparks, indices, indexValue, nameOf, reload],
  );
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket 은 MarketProvider 안에서만 쓸 수 있어요");
  return ctx;
}
