"use client";

import { useMemo } from "react";
import type { OrderBookLevel } from "@/lib/database.types";
import { formatGalleon, formatPct } from "@/lib/format";
import { changeRatio, priceBounds, tickSize, type TradeConfig } from "@/lib/market";
import { buildLadder } from "./chart-data";
import { HelpTip, Term } from "./help-tip";

/**
 * 호가창. 현재가 위(매도 호가 · 파랑) 아래(매수 호가 · 빨강)로 호가 단위 사다리를 그리고,
 * 가격대별 지정가 잔량을 막대로 보여준다. 가격을 누르면 그 가격으로 지정가 주문을 준비한다.
 */
export function OrderBook({
  book,
  price,
  dayOpen,
  config,
  myOrderPrices,
  onPick,
}: {
  book: OrderBookLevel[] | null;
  price: number;
  dayOpen: number;
  config: Pick<TradeConfig, "min_price" | "price_limit_rate">;
  /** 내 미체결 주문이 걸린 가격 (표시용) */
  myOrderPrices: Set<number>;
  onPick: (price: number) => void;
}) {
  const bounds = priceBounds(config, dayOpen);
  const { lo, hi } = bounds;
  const rows = useMemo(
    () =>
      buildLadder(
        (book ?? []).map((l) => ({ ...l, price: Number(l.price), qty: Number(l.qty), orders: Number(l.orders) })),
        price,
        { lo, hi },
        4,
      ),
    [book, price, lo, hi],
  );
  const maxQty = Math.max(1, ...rows.map((r) => Math.max(r.sellQty, r.buyQty)));
  const totalSell = rows.reduce((s, r) => s + r.sellQty, 0);
  const totalBuy = rows.reduce((s, r) => s + r.buyQty, 0);

  return (
    <div className="text-xs">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h2 className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-100">
          호가 <HelpTip term="호가" />
        </h2>
        <span className="text-[11px] text-slate-500">
          <Term k="호가단위">호가단위 {formatGalleon(tickSize(price))}</Term>
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] border-b border-white/6 px-1 pb-1 text-[11px] text-slate-500">
        <span>
          <Term k="매도잔량">매도잔량</Term>
        </span>
        <span className="text-center">호가 · 등락률</span>
        <span className="text-right">
          <Term k="매수잔량">매수잔량</Term>
        </span>
      </div>
      {book === null ? (
        <div className="space-y-1 py-2" role="status" aria-label="호가 불러오는 중">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="skeleton block h-6" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.03]">
          {rows.map((r) => {
            const isCur = r.price === price;
            const above = r.price > price;
            const tone = r.price > dayOpen ? "text-rise" : r.price < dayOpen ? "text-fall" : "text-slate-200";
            const isLimit = r.price === bounds.hi || r.price === bounds.lo;
            return (
              <li key={r.price}>
                <button
                  type="button"
                  onClick={() => onPick(r.price)}
                  title={`${formatGalleon(r.price)} 갈레온으로 지정가 주문`}
                  className={`grid h-7 w-full grid-cols-[1fr_auto_1fr] items-center gap-1 px-1 text-left tabular-nums hover:bg-white/[0.06] ${
                    above ? "bg-fall/[0.05]" : isCur ? "" : "bg-rise/[0.05]"
                  } ${isCur ? "relative z-[1] ring-1 ring-inset ring-slate-200/60" : ""}`}
                >
                  <span className="relative flex h-full items-center justify-end overflow-hidden pr-1">
                    {r.sellQty > 0 && (
                      <>
                        <i className="absolute inset-y-1 right-0 rounded-l bg-fall/25" style={{ width: `${(r.sellQty / maxQty) * 100}%` }} />
                        <span className="relative text-fall">{formatGalleon(r.sellQty)}</span>
                      </>
                    )}
                  </span>
                  <span className={`min-w-[6.5rem] text-center ${tone}`}>
                    <b className="font-semibold">{formatGalleon(r.price)}</b>
                    <span className="ml-1 text-[10px] opacity-80">{formatPct(changeRatio(r.price, dayOpen), 1)}</span>
                    {myOrderPrices.has(r.price) && <span className="ml-0.5 text-[9px] text-gold">●</span>}
                    {isLimit && <span className="ml-0.5 text-[9px] text-slate-400">{r.price === bounds.hi ? "상" : "하"}</span>}
                  </span>
                  <span className="relative flex h-full items-center overflow-hidden pl-1">
                    {r.buyQty > 0 && (
                      <>
                        <i className="absolute inset-y-1 left-0 rounded-r bg-rise/25" style={{ width: `${(r.buyQty / maxQty) * 100}%` }} />
                        <span className="relative text-rise">{formatGalleon(r.buyQty)}</span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] border-t border-white/6 px-1 pt-1.5 text-[11px] tabular-nums">
        <span className="text-fall">{formatGalleon(totalSell)}</span>
        <span className="text-center text-slate-500">총잔량</span>
        <span className="text-right text-rise">{formatGalleon(totalBuy)}</span>
      </div>
      <p className="mt-2 flex gap-1 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[11px] leading-relaxed text-slate-400">
        <span>
          잔량은 사람들이 걸어 둔 <b className="text-slate-300">지정가 주문</b>이에요. <b className="text-slate-300">시장가</b>는{" "}
          <Term k="마켓메이커">마켓메이커</Term>가 즉시 체결해 줘요. 가격을 누르면 지정가로 주문할 수 있어요.
          {myOrderPrices.size > 0 && (
            <>
              {" "}
              <span className="text-gold">●</span> 내 주문
            </>
          )}
        </span>
      </p>
    </div>
  );
}
