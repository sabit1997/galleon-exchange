"use client";

import type { Candle, Earning, MarketConfig, Stock } from "@/lib/database.types";
import { formatGalleon, formatPct } from "@/lib/format";
import { changeRatio, priceBounds } from "@/lib/market";
import { formatKoreanUnit } from "./chart-data";
import { HelpTip, Term, type GlossaryKey } from "./help-tip";

/** 지난주 실제 공부시간이 발표된 가장 최근 실적 */
export function lastAnnounced(earnings: Earning[] | null): Earning | null {
  return earnings?.find((e) => e.actual !== null) ?? null;
}

/** 공부 PER = 현재가 ÷ 지난주 실제 공부시간(분). 데이터가 없으면 null */
export function studyPer(price: number, earnings: Earning[] | null): number | null {
  const last = lastAnnounced(earnings);
  if (!last || !last.actual) return null;
  return price / last.actual;
}

/** 종목 정보: 기준가 · 시고저 · 상하한가 · 거래량 · 시가총액 · 전체기간 최고/최저 · 공부 PER */
export function StockInfo({
  stock,
  config,
  candles,
  earnings,
  today,
}: {
  stock: Stock;
  config: MarketConfig;
  candles: Candle[] | null;
  earnings: Earning[] | null;
  today: string;
}) {
  const bounds = priceBounds(config, stock.day_open);
  const todayCandle = candles?.find((c) => c.day === today) ?? null;
  const prevCandle = candles?.find((c) => c.day < today) ?? null;
  const high = Math.max(todayCandle?.high ?? stock.day_open, stock.price);
  const low = Math.min(todayCandle?.low ?? stock.day_open, stock.price);
  const allHigh = Math.max(stock.price, ...(candles ?? []).map((c) => c.high));
  const allLow = Math.min(stock.price, ...(candles ?? []).map((c) => c.low));
  const per = studyPer(stock.price, earnings);
  const last = lastAnnounced(earnings);
  const tone = (p: number) => (p > stock.day_open ? "text-rise" : p < stock.day_open ? "text-fall" : "text-slate-200");
  const marketCap = stock.price * config.shares_outstanding;

  const rows: { k: GlossaryKey; label?: string; value: React.ReactNode; sub?: React.ReactNode }[] = [
    { k: "기준가", value: formatGalleon(stock.day_open) },
    {
      k: "시가",
      value: <span className={tone(todayCandle?.open ?? stock.day_open)}>{formatGalleon(todayCandle?.open ?? stock.day_open)}</span>,
    },
    { k: "고가", value: <span className={tone(high)}>{formatGalleon(high)}</span>, sub: formatPct(changeRatio(high, stock.day_open)) },
    { k: "저가", value: <span className={tone(low)}>{formatGalleon(low)}</span>, sub: formatPct(changeRatio(low, stock.day_open)) },
    { k: "상한가", value: <span className="text-rise">{formatGalleon(bounds.hi)}</span> },
    { k: "하한가", value: <span className="text-fall">{formatGalleon(bounds.lo)}</span> },
    { k: "거래량", value: `${formatGalleon(todayCandle?.volume ?? 0)}주` },
    { k: "거래대금", value: formatKoreanUnit(todayCandle?.value ?? 0) },
    { k: "시가총액", value: formatKoreanUnit(marketCap), sub: `${formatGalleon(config.shares_outstanding)}주` },
    {
      k: "공부PER",
      label: "공부 PER",
      value: per === null ? "-" : `${per.toFixed(2)}배`,
      sub: last?.actual ? `지난주 ${formatGalleon(last.actual)}분` : undefined,
    },
    { k: "52주", label: "전체 최고", value: <span className="text-rise">{formatGalleon(allHigh)}</span> },
    { k: "52주", label: "전체 최저", value: <span className="text-fall">{formatGalleon(allLow)}</span> },
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 text-xs">
        {rows.map((r) => (
          <div key={r.label ?? r.k} className="flex items-center justify-between gap-2 border-b border-white/[0.04] py-1.5">
            <dt className="shrink-0 text-slate-500">
              <Term k={r.k}>{r.label ?? r.k}</Term>
            </dt>
            <dd className="min-w-0 truncate text-right tabular-nums font-medium text-slate-200">
              {r.value}
              {r.sub && <span className="ml-1 text-[10px] font-normal text-slate-500">{r.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        전일 종가 <b className="tabular-nums font-medium text-slate-300">{prevCandle ? formatGalleon(prevCandle.close) : "-"}</b>
        <span className="mx-1">·</span>
        장기 평균가 <b className="tabular-nums font-medium text-slate-300">{formatGalleon(stock.base_price)}</b>
        <HelpTip text="상장 때 정해진 장기 기준 가격이에요. 매일 자정 주가가 이 가격 쪽으로 조금씩 되돌아가요(평균 회귀)." />
      </p>
    </div>
  );
}
