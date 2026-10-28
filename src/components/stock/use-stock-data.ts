"use client";

import { useCallback, useEffect, useState } from "react";
import { useMemberSession } from "@/components/providers/session-provider";
import type { Candle, Earning, MarketEvent, MarketNews, OrderBookLevel, PriceTick, Trade } from "@/lib/database.types";

/** 분봉에 쓰는 기간 · 개수 */
const INTRADAY_DAYS = 2;
const ROW_LIMIT = 1000;
const NEWS_LIMIT = 30;
const EVENT_LIMIT = 20;
const BOOK_POLL_MS = 10_000;

export type TickRow = Pick<PriceTick, "id" | "price" | "created_at" | "cause">;
export type TradeRow = Pick<Trade, "id" | "qty" | "gross" | "exec_price" | "side" | "created_at" | "forced" | "position" | "order_type">;

export type StockData = {
  ticks: TickRow[] | null;
  trades: TradeRow[] | null;
  candles: Candle[] | null;
  earnings: Earning[] | null;
  news: MarketNews[] | null;
  events: MarketEvent[] | null;
  book: OrderBookLevel[] | null;
  reloadBook: () => void;
};

const byIdAsc = <T extends { id: number }>(a: T, b: T) => a.id - b.id;

/** 종목 한 개의 차트 · 체결 · 일봉 · 실적 · 뉴스 · 호가를 읽고 실시간으로 이어 붙인다. */
export function useStockData(id: string): StockData {
  const { supabase, guildId } = useMemberSession();
  const [ticks, setTicks] = useState<TickRow[] | null>(null);
  const [trades, setTrades] = useState<TradeRow[] | null>(null);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [earnings, setEarnings] = useState<Earning[] | null>(null);
  const [news, setNews] = useState<MarketNews[] | null>(null);
  const [events, setEvents] = useState<MarketEvent[] | null>(null);
  const [book, setBook] = useState<OrderBookLevel[] | null>(null);

  const loadBook = useCallback(async () => {
    const { data, error } = await supabase.rpc("order_book", { p_guild: guildId, p_stock: id });
    if (!error) setBook(data);
    else setBook((prev) => prev ?? []);
  }, [supabase, guildId, id]);

  // 일봉은 Realtime 대상이 아니라서 체결이 들어올 때마다 다시 읽는다 (거래량 · 거래대금)
  const loadCandles = useCallback(async () => {
    const { data } = await supabase
      .from("candles")
      .select("*")
      .eq("guild_id", guildId)
      .eq("discord_id", id)
      .order("day", { ascending: false })
      .limit(400);
    setCandles(data ?? []);
  }, [supabase, guildId, id]);

  const loadEarnings = useCallback(async () => {
    const { data } = await supabase
      .from("earnings")
      .select("*")
      .eq("guild_id", guildId)
      .eq("discord_id", id)
      .order("week_start", { ascending: false })
      .limit(12);
    setEarnings(data ?? []);
  }, [supabase, guildId, id]);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      const since = new Date(Date.now() - INTRADAY_DAYS * 86_400_000).toISOString();
      const [tickRes, tradeRes, newsRes, eventRes] = await Promise.all([
        supabase
          .from("price_ticks")
          .select("id, price, created_at, cause")
          .eq("guild_id", guildId)
          .eq("discord_id", id)
          .gte("created_at", since)
          .order("id", { ascending: false })
          .limit(ROW_LIMIT),
        supabase
          .from("trades")
          .select("id, qty, gross, exec_price, side, created_at, forced, position, order_type")
          .eq("guild_id", guildId)
          .eq("stock_id", id)
          .gte("created_at", since)
          .order("id", { ascending: false })
          .limit(ROW_LIMIT),
        supabase
          .from("market_news")
          .select("*")
          .eq("guild_id", guildId)
          .eq("target", id)
          .order("id", { ascending: false })
          .limit(NEWS_LIMIT),
        supabase
          .from("market_events")
          .select("*")
          .eq("guild_id", guildId)
          .eq("discord_id", id)
          .order("id", { ascending: false })
          .limit(EVENT_LIMIT),
      ]);
      if (cancelled) return;
      setTicks([...(tickRes.data ?? [])].sort(byIdAsc));
      setTrades([...(tradeRes.data ?? [])].sort(byIdAsc));
      setNews(newsRes.data ?? []);
      setEvents(eventRes.data ?? []);
      await Promise.all([loadCandles(), loadEarnings(), loadBook()]);
    };

    const channel = supabase
      .channel(`stock-screen:${guildId}:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "price_ticks", filter: `discord_id=eq.${id}` }, (payload) => {
        const row = payload.new as PriceTick;
        if (row.guild_id !== guildId) return;
        setTicks((prev) => (prev && !prev.some((t) => t.id === row.id) ? [...prev, row].slice(-ROW_LIMIT) : prev));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades", filter: `stock_id=eq.${id}` }, (payload) => {
        const row = payload.new as Trade;
        if (row.guild_id !== guildId) return;
        setTrades((prev) => (prev && !prev.some((t) => t.id === row.id) ? [...prev, row].slice(-ROW_LIMIT) : prev));
        // 체결은 지정가 주문을 채우고 일봉 거래량을 바꾼다
        void loadCandles();
        void loadBook();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_news", filter: `target=eq.${id}` }, (payload) => {
        const row = payload.new as MarketNews;
        if (row.guild_id !== guildId) return;
        setNews((prev) => (prev && !prev.some((n) => n.id === row.id) ? [row, ...prev].slice(0, NEWS_LIMIT) : prev));
        if (row.kind === "earnings" || row.kind === "dividend") void loadEarnings();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_events", filter: `discord_id=eq.${id}` }, (payload) => {
        const row = payload.new as MarketEvent;
        if (row.guild_id !== guildId) return;
        setEvents((prev) => (prev && !prev.some((e) => e.id === row.id) ? [row, ...prev].slice(0, EVENT_LIMIT) : prev));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "earnings", filter: `discord_id=eq.${id}` }, () => {
        void loadEarnings();
      })
      .subscribe((status) => {
        // (재)연결될 때마다 전부 다시 읽어 놓친 변경을 메운다. 연결 실패해도 처음 한 번은 읽는다.
        if (status !== "CLOSED") void loadAll();
      });

    // 다른 사람의 지정가 주문은 RLS 로 Realtime 이 오지 않아서 호가는 주기적으로 다시 읽는다
    const timer = setInterval(() => void loadBook(), BOOK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId, id, loadBook, loadCandles, loadEarnings]);

  const reloadBook = useCallback(() => void loadBook(), [loadBook]);

  return { ticks, trades, candles, earnings, news, events, book, reloadBook };
}
