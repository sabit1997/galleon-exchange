"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventLabel, eventIcon } from "@/components/market/event-text";
import { useMarket } from "@/components/providers/market-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Card, Empty, PageTitle, Spinner } from "@/components/ui/card";
import { HouseBadge } from "@/components/ui/house-badge";
import { useNow } from "@/hooks/use-now";
import type { MarketEvent, Trade } from "@/lib/database.types";
import { formatPrice, formatRelativeTime } from "@/lib/format";

const PAGE = 40;
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
      <PageTitle title="📰 예언자 일보" subtitle="호그와트 증권가의 소식이 실시간으로 도착해요." />
      <Card className="!p-0 overflow-hidden">
        {items === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty>아직 조용한 하루예요.</Empty>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li key={item.key} className="flex gap-3 px-4 py-3 text-sm">
                {item.kind === "event" ? <EventItem row={item.row} /> : <TradeItem row={item.row} />}
                <span className="ml-auto shrink-0 text-xs text-slate-500">{formatRelativeTime(item.at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StockLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/stocks/${encodeURIComponent(id)}`} className="font-semibold text-slate-100 hover:text-gold">
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
