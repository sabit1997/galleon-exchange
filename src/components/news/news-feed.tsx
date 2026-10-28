"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventLabel, eventIcon } from "@/components/market/event-text";
import { useMarket } from "@/components/providers/market-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Empty, SkeletonRows } from "@/components/ui/card";
import { ChangePct } from "@/components/ui/galleon";
import { HouseBadge } from "@/components/ui/house-badge";
import { kstTime } from "@/components/ui/kst";
import { ChipGroup } from "@/components/ui/tabs";
import { LearnHint, Tag } from "@/components/ui/tag";
import { useNow } from "@/hooks/use-now";
import type { MarketEvent, MarketNews, Trade } from "@/lib/database.types";
import { formatGalleon, formatRelativeTime } from "@/lib/format";
import { NEWS_KIND_LABEL, newsTone, tradeKindLabel } from "./news-kinds";

const PAGE = 60;
const MAX_ITEMS = 240;

const mastheadDate = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const dayKeyFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });

type FeedItem =
  | { kind: "news"; at: string; key: string; row: MarketNews }
  | { kind: "event"; at: string; key: string; row: MarketEvent }
  | { kind: "trade"; at: string; key: string; row: Trade };

const fromNews = (row: MarketNews): FeedItem => ({ kind: "news", at: row.created_at, key: `n${row.id}`, row });
const fromEvent = (row: MarketEvent): FeedItem => ({ kind: "event", at: row.created_at, key: `e${row.id}`, row });
const fromTrade = (row: Trade): FeedItem => ({ kind: "trade", at: row.created_at, key: `t${row.id}`, row });

function merge(prev: FeedItem[], incoming: FeedItem[]): FeedItem[] {
  const seen = new Set(prev.map((i) => i.key));
  const next = [...prev, ...incoming.filter((i) => !seen.has(i.key))];
  next.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return next.slice(0, MAX_ITEMS);
}

type Filter = "all" | "macro" | "sector" | "rumor" | "earnings" | "study" | "trade" | "limit";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "macro", label: "시장" },
  { key: "sector", label: "업종" },
  { key: "rumor", label: "루머" },
  { key: "earnings", label: "실적·배당" },
  { key: "study", label: "공부 이벤트" },
  { key: "trade", label: "체결" },
  { key: "limit", label: "VI·상하한가" },
];

/** 필터마다 붙는 초보자용 설명 */
const FILTER_HINTS: Record<Filter, { text: string; term: string }> = {
  all: { text: "뉴스 · 공부 이벤트 · 친구들의 체결 소식이 한 줄로 모여요. 뉴스가 나오면 관련 종목 주가가 바로 움직여요.", term: "news" },
  macro: {
    text: "시장 전체 뉴스는 모든 종목을 함께 1~3% 움직여요 (종목마다 0.7~1.3배). 지수가 한꺼번에 오르내리는 이유예요.",
    term: "index",
  },
  sector: {
    text: "업종 뉴스는 한 기숙사 종목만 1.5~4% 움직여요. 같은 업종에만 몰아 사면 이런 뉴스 한 방에 같이 흔들려요 → 분산투자.",
    term: "diversify",
  },
  rumor: {
    text: "루머는 사실 확인이 안 된 소문이에요. 여기서는 호재·악재가 반반 확률로 무작위로 나와 한 종목을 2~6% 움직여요. 쫓아가 사면 수수료만 낼 수 있어요.",
    term: "news",
  },
  earnings: {
    text: "매주 월요일 00:00, 지난주 공부시간(실적)을 예상치(컨센서스)와 비교해 발표해요. 웃돌면 어닝 서프라이즈, 밑돌면 쇼크. 배당 뒤엔 배당락으로 주가가 내려가요.",
    term: "earnings",
  },
  study: { text: "디스코드에서 교시 완주 · 황금 스니치 · 벌점 같은 일이 생기면 그 학생 주가가 바로 움직여요.", term: "price" },
  trade: {
    text: "친구들의 체결 내역이에요. 신용 · 공매도 · 지정가 표시와, 담보가 모자라 강제로 정리된 반대매매도 볼 수 있어요.",
    term: "fill",
  },
  limit: {
    text: "VI는 기준가(또는 직전 VI 가격)에서 10% 넘게 움직이면 2분간 시장가 거래를 멈추는 장치예요. 상·하한가는 하루 ±30% 끝까지 간 상태예요.",
    term: "vi",
  },
};

function matches(item: FeedItem, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "study") return item.kind === "event";
  if (f === "trade") return item.kind === "trade";
  if (item.kind !== "news") return false;
  const k = item.row.kind;
  if (f === "earnings") return k === "earnings" || k === "dividend";
  if (f === "limit") return k === "vi" || k === "limit_up" || k === "limit_down";
  return k === f;
}

export function NewsFeed() {
  const { supabase, guildId } = useMemberSession();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const now = useNow();

  useEffect(() => {
    const load = async () => {
      const [nw, ev, tr] = await Promise.all([
        supabase.from("market_news").select("*").eq("guild_id", guildId).order("id", { ascending: false }).limit(PAGE),
        supabase.from("market_events").select("*").eq("guild_id", guildId).order("id", { ascending: false }).limit(PAGE),
        supabase.from("trades").select("*").eq("guild_id", guildId).order("id", { ascending: false }).limit(PAGE),
      ]);
      setItems((prev) =>
        merge(prev ?? [], [...(nw.data ?? []).map(fromNews), ...(ev.data ?? []).map(fromEvent), ...(tr.data ?? []).map(fromTrade)]),
      );
    };
    const channel = supabase
      .channel(`news:${guildId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_news", filter: `guild_id=eq.${guildId}` }, (p) => {
        setItems((prev) => merge(prev ?? [], [fromNews(p.new as MarketNews)]));
      })
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

  const visible = useMemo(() => (items ?? []).filter((i) => matches(i, filter)), [items, filter]);
  // 날짜가 바뀌는 곳에 구분선
  const rows = useMemo(() => {
    const days = visible.map((item) => dayKeyFmt.format(Date.parse(item.at)));
    return visible.map((item, i) => ({ item, divider: i === 0 || days[i] !== days[i - 1] ? days[i] : null }));
  }, [visible]);
  const hint = FILTER_HINTS[filter];

  return (
    <div className="space-y-3">
      <header className="animate-fade-up border-b-2 border-double border-white/15 pb-3 text-center">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-rise">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rise animate-pulse-dot" />
          실시간 발행
        </p>
        <h1 className="mt-1 font-serif text-[2rem] font-black leading-none tracking-tight text-slate-50 sm:text-[2.4rem]">예언자 일보</h1>
        <p className="mt-2 text-[12px] text-slate-500">{mastheadDate.format(now)} · 마법 증권가 속보 · 공시 · 체결</p>
      </header>

      <ChipGroup label="뉴스 분류" options={FILTERS} value={filter} onChange={setFilter} />
      <LearnHint term={hint.term}>{hint.text}</LearnHint>

      <section className="sheet overflow-hidden rounded-2xl">
        {items === null ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <Empty>{filter === "all" ? "아직 조용한 하루예요." : "이 분류의 소식이 아직 없어요."}</Empty>
        ) : (
          <ul>
            {rows.map(({ item, divider }) => (
              <li key={item.key}>
                {divider && (
                  <p className="border-b border-white/5 bg-white/[0.02] px-4 py-1.5 text-[11.5px] font-semibold text-slate-400 sm:px-5">{divider}</p>
                )}
                <div className="flex gap-3 border-b border-white/[0.04] px-4 py-3 text-[13.5px] sm:px-5">
                  <time dateTime={item.at} className="w-10 shrink-0 pt-px text-[12px] text-slate-500 tabular-nums" title={formatRelativeTime(item.at, now)}>
                    {kstTime(item.at)}
                  </time>
                  <div className="min-w-0 flex-1">
                    {item.kind === "news" ? (
                      <NewsItem row={item.row} />
                    ) : item.kind === "event" ? (
                      <EventItem row={item.row} />
                    ) : (
                      <TradeItem row={item.row} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StockLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/stocks/${encodeURIComponent(id)}`} className="font-semibold text-slate-50 underline-offset-4 hover:text-magic-bright hover:underline">
      {name}
    </Link>
  );
}

function NewsItem({ row }: { row: MarketNews }) {
  const { stocks, nameOf } = useMarket();
  const pct = row.pct == null ? 0 : Number(row.pct);
  const stockTarget = row.target && row.kind !== "sector" && row.kind !== "macro" ? row.target : null;
  return (
    <>
      <p className="flex flex-wrap items-center gap-1.5">
        <Tag tone={newsTone(row.kind)}>{NEWS_KIND_LABEL[row.kind]}</Tag>
        {row.kind === "sector" && row.target && <HouseBadge house={row.target} />}
        {stockTarget && stocks.has(stockTarget) && <StockLink id={stockTarget} name={nameOf(stockTarget)} />}
      </p>
      <p className="mt-1 leading-snug text-slate-100">{row.headline}</p>
      {pct !== 0 && (
        <p className="mt-0.5 text-[12px] text-slate-500">
          {row.kind === "vi" ? "직전 대비" : row.kind === "limit_up" || row.kind === "limit_down" ? "기준가 대비" : "주가 영향"}{" "}
          <ChangePct ratio={pct} className="font-medium" />
        </p>
      )}
    </>
  );
}

function EventItem({ row }: { row: MarketEvent }) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-1.5">
        <Tag tone="magic">공부</Tag>
        <StockLink id={row.discord_id} name={row.display_name} />
        <HouseBadge house={row.house} />
      </p>
      <p className="mt-1 text-slate-200">
        <span aria-hidden className="mr-1">
          {eventIcon(row.type)}
        </span>
        <EventLabel event={row} />
      </p>
    </>
  );
}

function TradeItem({ row }: { row: Trade }) {
  const { nameOf } = useMarket();
  const buy = row.side === "buy";
  return (
    <>
      <p className="flex flex-wrap items-center gap-1.5">
        <Tag tone={buy ? "rise" : "fall"}>{tradeKindLabel(row)}</Tag>
        {row.position === "credit" && <Tag tone="warn">신용</Tag>}
        {row.position === "short" && <Tag tone="sky">공매도</Tag>}
        {row.order_type === "limit" && <Tag>지정가</Tag>}
        {row.forced && (
          <Tag tone="danger" title="담보비율이 기준 아래로 떨어져 강제로 정리됐어요">
            반대매매
          </Tag>
        )}
      </p>
      <p className="mt-1 leading-snug text-slate-300">
        <span className="font-medium text-slate-100">{nameOf(row.owner_id)}</span> · <StockLink id={row.stock_id} name={nameOf(row.stock_id)} />{" "}
        <span className="tabular-nums">{formatGalleon(row.qty)}주</span>{" "}
        <span className={`font-semibold ${buy ? "text-rise" : "text-fall"}`}>{buy ? "매수" : "매도"}</span> 체결
        <span className="ml-1.5 text-[12px] text-slate-500 tabular-nums">@ {formatGalleon(row.exec_price)}</span>
      </p>
    </>
  );
}
