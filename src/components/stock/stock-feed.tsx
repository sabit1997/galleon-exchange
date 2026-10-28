"use client";

import { useMemo } from "react";
import { EventLabel, eventIcon } from "@/components/market/event-text";
import { ChangePct } from "@/components/ui/galleon";
import type { MarketEvent, MarketNews, NewsKind } from "@/lib/database.types";
import { formatGalleon, formatRelativeTime } from "@/lib/format";
import { HelpTip } from "./help-tip";
import type { TradeRow } from "./use-stock-data";

const KIND_LABEL: Record<NewsKind, { text: string; cls: string }> = {
  macro: { text: "시장", cls: "bg-white/8 text-slate-300" },
  sector: { text: "업종", cls: "bg-white/8 text-slate-300" },
  rumor: { text: "루머", cls: "bg-magic/15 text-magic-bright" },
  earnings: { text: "실적", cls: "bg-gold/15 text-gold" },
  dividend: { text: "배당", cls: "bg-gold/15 text-gold" },
  vi: { text: "VI", cls: "bg-amber-400/15 text-amber-300" },
  limit_up: { text: "상한가", cls: "bg-rise/15 text-rise" },
  limit_down: { text: "하한가", cls: "bg-fall/15 text-fall" },
};

type FeedItem =
  | { key: string; at: string; type: "news"; news: MarketNews }
  | { key: string; at: string; type: "event"; event: MarketEvent };

/** 종목 뉴스 · 공시 (market_news) 와 공부 이벤트 (market_events) 를 시간순으로 */
export function StockFeed({ news, events, now }: { news: MarketNews[] | null; events: MarketEvent[] | null; now: number }) {
  const items = useMemo<FeedItem[] | null>(() => {
    if (!news || !events) return null;
    const all: FeedItem[] = [
      ...news.map((n) => ({ key: `n${n.id}`, at: n.created_at, type: "news" as const, news: n })),
      ...events.map((e) => ({ key: `e${e.id}`, at: e.occurred_at, type: "event" as const, event: e })),
    ];
    return all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 30);
  }, [news, events]);

  if (items === null) return <div className="skeleton h-40" role="status" aria-label="뉴스 불러오는 중" />;
  if (items.length === 0) return <p className="py-6 text-center text-xs text-slate-500">아직 이 종목의 소식이 없어요.</p>;

  return (
    <ul className="divide-y divide-white/[0.04]">
      {items.map((it) => (
        <li key={it.key} className="flex items-start gap-2.5 py-2 text-xs">
          {it.type === "news" ? (
            <span className={`mt-px w-11 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold ${KIND_LABEL[it.news.kind].cls}`}>
              {KIND_LABEL[it.news.kind].text}
            </span>
          ) : (
            <span className="mt-px w-11 shrink-0 rounded bg-sky/10 px-1 py-0.5 text-center text-[10px] font-bold text-sky">
              <span aria-hidden>{eventIcon(it.event.type)}</span> 공부
            </span>
          )}
          <span className="min-w-0 flex-1 leading-relaxed text-slate-200">
            {it.type === "news" ? (
              <>
                {it.news.headline}
                {it.news.pct !== null && it.news.pct !== 0 && <ChangePct ratio={it.news.pct} className="ml-1.5 text-[11px]" />}
              </>
            ) : (
              <EventLabel event={it.event} />
            )}
          </span>
          <span className="shrink-0 text-[10px] text-slate-500">{formatRelativeTime(it.at, now)}</span>
        </li>
      ))}
    </ul>
  );
}

const KST_MS = 9 * 60 * 60 * 1000;
const hms = (iso: string) => new Date(Date.parse(iso) + KST_MS).toISOString().slice(11, 19);

const POSITION_TAG: Record<TradeRow["position"], string> = { cash: "", credit: "신용", short: "공매도" };

/** 실시간 체결 (최근 순) */
export function TradeTape({ trades, dayOpen }: { trades: TradeRow[] | null; dayOpen: number }) {
  const rows = useMemo(() => (trades ? [...trades].reverse().slice(0, 30) : null), [trades]);
  return (
    <div className="text-xs">
      <h2 className="mb-1.5 flex items-center gap-1 px-1 text-[13px] font-semibold text-slate-100">
        체결 <HelpTip term="체결" />
      </h2>
      <div className="grid grid-cols-[auto_1fr_auto] gap-2 border-b border-white/6 px-1 pb-1 text-[11px] text-slate-500">
        <span>시각</span>
        <span className="text-right">체결가</span>
        <span className="w-16 text-right">체결량</span>
      </div>
      {rows === null ? (
        <div className="skeleton mt-1 h-24" role="status" aria-label="체결 불러오는 중" />
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-slate-500">최근 이틀간 체결이 없어요.</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {rows.map((t) => {
            const tone = t.exec_price > dayOpen ? "text-rise" : t.exec_price < dayOpen ? "text-fall" : "text-slate-200";
            const tag = t.forced ? "반대매매" : POSITION_TAG[t.position] || (t.order_type === "limit" ? "지정가" : "");
            return (
              <li key={t.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-1 py-1 tabular-nums">
                <span className="text-slate-500">{hms(t.created_at)}</span>
                <span className={`text-right font-medium ${tone}`}>
                  {tag && <span className="mr-1 text-[9px] font-normal text-slate-500">{tag}</span>}
                  {formatGalleon(t.exec_price)}
                </span>
                <span className={`w-16 text-right ${t.side === "buy" ? "text-rise" : "text-fall"}`}>{formatGalleon(t.qty)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
