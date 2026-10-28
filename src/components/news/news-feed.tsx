"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventLabel, eventIcon } from "@/components/market/event-text";
import { useMarket } from "@/components/providers/market-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Empty, Spinner } from "@/components/ui/card";
import { HouseBadge } from "@/components/ui/house-badge";
import { useNow } from "@/hooks/use-now";
import type { MarketEvent, Trade } from "@/lib/database.types";
import { formatPrice, formatRelativeTime } from "@/lib/format";

const PAGE = 40;

const mastheadDate = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const MAX_ITEMS = 150;

type NewsItem = { kind: "event"; at: string; key: string; row: MarketEvent } | { kind: "trade"; at: string; key: string; row: Trade };

const fromEvent = (row: MarketEvent): NewsItem => ({ kind: "event", at: row.created_at, key: `e${row.id}`, row });
const fromTrade = (row: Trade): NewsItem => ({ kind: "trade", at: row.created_at, key: `t${row.id}`, row });

function merge(prev: NewsItem[], incoming: NewsItem[]): NewsItem[] {
  const seen = new Set(prev.map((i) => i.key));
  const next = [...prev, ...incoming.filter((i) => !seen.has(i.key))];
  next.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return next.slice(0, MAX_ITEMS);
}

export function NewsFeed() {
  const { supabase, guildId } = useMemberSession();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const now = useNow();

  useEffect(() => {
    const load = async () => {
      const [ev, tr] = await Promise.all([
        supabase.from("market_events").select("*").eq("guild_id", guildId).order("id", { ascending: false }).limit(PAGE),
        supabase.from("trades").select("*").eq("guild_id", guildId).order("id", { ascending: false }).limit(PAGE),
      ]);
      setItems((prev) => merge(prev ?? [], [...(ev.data ?? []).map(fromEvent), ...(tr.data ?? []).map(fromTrade)]));
    };
    const channel = supabase
      .channel(`news:${guildId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_events", filter: `guild_id=eq.${guildId}` }, (p) => {
        setItems((prev) => merge(prev ?? [], [fromEvent(p.new as MarketEvent)]));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades", filter: `guild_id=eq.${guildId}` }, (p) => {
        setItems((prev) => merge(prev ?? [], [fromTrade(p.new as Trade)]));
      })
      .subscribe((status) => {
        if (status !== "CLOSED") void load();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId]);

  return (
    <div>
      {/* 신문 1면 느낌의 양피지 */}
      <article className="parchment overflow-hidden rounded-sm">
        <header className="px-4 pt-5 text-center sm:px-6">
          <p className="font-display text-[10px] tracking-[0.3em] text-slate-400">마법 증권가 소식지 · 실시간 발행</p>
          <h1 className="font-display mt-1 text-4xl font-bold tracking-wider text-slate-50 sm:text-5xl">예언자 일보</h1>
          <div className="mt-3 border-y-[3px] border-double border-slate-300/70 py-1 text-[11px] text-slate-400 sm:text-xs">
            <span>{mastheadDate.format(now)}</span>
            <span className="mx-2" aria-hidden>
              ✦
            </span>
            <span>호그와트 증권가의 소식이 실시간으로 도착해요</span>
          </div>
        </header>
        {items === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty>아직 조용한 하루예요.</Empty>
        ) : (
          <ul className="divide-y divide-slate-300/25 px-1 pb-2 sm:px-2">
            {items.map((item) => (
              <li key={item.key} className="flex gap-3 px-3 py-3 text-sm">
                {item.kind === "event" ? <EventItem row={item.row} /> : <TradeItem row={item.row} />}
                <span className="ml-auto shrink-0 text-xs text-slate-500">{formatRelativeTime(item.at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

function StockLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/stocks/${encodeURIComponent(id)}`} className="font-display font-bold text-slate-100 underline-offset-2 hover:text-gold hover:underline">
      {name}
    </Link>
  );
}

function EventItem({ row }: { row: MarketEvent }) {
  return (
    <>
      <span aria-hidden className="text-lg leading-5">
        {eventIcon(row.type)}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StockLink id={row.discord_id} name={row.display_name} />
          <HouseBadge house={row.house} />
        </p>
        <p className="mt-0.5 text-slate-300">
          <EventLabel event={row} />
        </p>
      </div>
    </>
  );
}

function TradeItem({ row }: { row: Trade }) {
  const { nameOf } = useMarket();
  const buy = row.side === "buy";
  return (
    <>
      <span aria-hidden className="text-lg leading-5">
        {buy ? "🛒" : "💸"}
      </span>
      <p className="min-w-0 text-slate-300">
        <span className="text-slate-100">{nameOf(row.owner_id)}</span> 님이 <StockLink id={row.stock_id} name={nameOf(row.stock_id)} />{" "}
        {row.qty.toLocaleString("ko-KR")}주를{" "}
        <span className={buy ? "text-rise" : "text-fall"}>{buy ? "매수" : "매도"}</span>했어요{" "}
        <span className="text-xs text-slate-500 tabular-nums">@ {formatPrice(row.exec_price)}</span>
      </p>
    </>
  );
}
