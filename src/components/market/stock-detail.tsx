"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket, type LiveStock } from "@/components/providers/market-provider";
import { Card, Empty, Spinner } from "@/components/ui/card";
import { HouseBadge, StockAvatar } from "@/components/ui/house-badge";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { kstDay, formatKoreanUnit } from "@/components/stock/chart-data";
import { EarningsPanel } from "@/components/stock/earnings-panel";
import { HelpTip, Term } from "@/components/stock/help-tip";
import { MyPosition, OpenOrders } from "@/components/stock/my-position";
import { OrderBook } from "@/components/stock/order-book";
import { StockFeed, TradeTape } from "@/components/stock/stock-feed";
import { StockInfo } from "@/components/stock/stock-info";
import { useStockData } from "@/components/stock/use-stock-data";
import { ViBadge } from "@/components/stock/vi-badge";
import { useNow } from "@/hooks/use-now";
import type { MarketConfig } from "@/lib/database.types";
import { formatGalleon, formatPct } from "@/lib/format";
import { changeRatio, priceBounds } from "@/lib/market";
import { PriceChart } from "./price-chart";
import { TradeForm, type PickedPrice, type SideRequest } from "./trade-form";

type MobileTab = "chart" | "book" | "order" | "info";
const MOBILE_TABS: { key: MobileTab; label: string }[] = [
  { key: "chart", label: "차트" },
  { key: "book", label: "호가" },
  { key: "order", label: "주문" },
  { key: "info", label: "정보" },
];

type InfoTab = "info" | "earnings" | "news";
const INFO_TABS: { key: InfoTab; label: string }[] = [
  { key: "info", label: "종목정보" },
  { key: "earnings", label: "실적" },
  { key: "news", label: "뉴스·공시" },
];

export function StockDetail() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  // 종목을 옮겨 다닐 때 차트 · 호가 · 주문 상태를 새로 시작한다
  return <StockScreen key={id} id={id} />;
}

function StockScreen({ id }: { id: string }) {
  const { stocks, config, loading } = useMarket();
  const { openOrders } = useAccount();
  const now = useNow();
  const data = useStockData(id);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [infoTab, setInfoTab] = useState<InfoTab>("info");
  const [picked, setPicked] = useState<PickedPrice | null>(null);
  const [sideRequest, setSideRequest] = useState<SideRequest | null>(null);
  const stock = stocks.get(id);
  const today = kstDay(now);

  const myOrderPrices = useMemo(
    () => new Set(openOrders.filter((o) => o.stock_id === id).map((o) => Number(o.limit_price))),
    [openOrders, id],
  );

  if (loading) return <Spinner />;
  if (!stock) {
    return (
      <Card>
        <Empty>
          상장되지 않은 학생이에요.{" "}
          <Link href="/" className="font-medium text-magic-bright underline underline-offset-4">
            시장으로 돌아가기
          </Link>
        </Empty>
      </Card>
    );
  }
  if (!config) {
    return (
      <Card>
        <Empty>시장 설정을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</Empty>
      </Card>
    );
  }

  const show = (tab: MobileTab) => (mobileTab === tab ? "" : "max-lg:hidden");
  const pick = (price: number) => {
    setPicked((p) => ({ price, nonce: (p?.nonce ?? 0) + 1 }));
    setMobileTab("order");
  };
  const requestSide = (side: SideRequest["side"]) => {
    setSideRequest((r) => ({ side, nonce: (r?.nonce ?? 0) + 1 }));
    setMobileTab("order");
  };
  const todayCandle = data.candles?.find((c) => c.day === today) ?? null;

  return (
    <div className="space-y-3">
      <Link
        href="/"
        className="pressable -ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-100"
      >
        <ArrowLeftIcon />
        시장
      </Link>

      <QuoteHeader stock={stock} config={config} volume={todayCandle?.volume ?? null} />

      {/* 모바일: 차트 / 호가 / 주문 / 정보 탭 */}
      <div className="grid grid-cols-4 rounded-xl bg-white/[0.04] p-1 lg:hidden" role="tablist" aria-label="화면 선택">
        {MOBILE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mobileTab === t.key}
            onClick={() => setMobileTab(t.key)}
            className={`rounded-lg py-2 text-sm font-semibold ${mobileTab === t.key ? "bg-white/12 text-slate-50" : "text-slate-400"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_minmax(0,632px)]">
        {/* 왼쪽: 차트 · 종목정보 */}
        <div className="min-w-0 space-y-3 max-lg:contents">
          <Card className={`!rounded-2xl !p-3 sm:!p-4 ${show("chart")}`}>
            <PriceChart
              ticks={data.ticks}
              trades={data.trades}
              candles={data.candles}
              price={stock.price}
              dayOpen={stock.day_open}
              updatedAt={stock.updated_at}
              today={today}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => requestSide("buy")}
                className="pressable h-11 rounded-xl bg-rise-deep text-sm font-bold text-white"
              >
                매수
              </button>
              <button
                type="button"
                onClick={() => requestSide("sell")}
                className="pressable h-11 rounded-xl bg-fall-deep text-sm font-bold text-white"
              >
                매도
              </button>
            </div>
          </Card>

          <Card className={`!rounded-2xl !p-3 sm:!p-4 ${show("info")}`}>
            <div className="mb-2 flex gap-4 border-b border-white/6 text-sm" role="tablist" aria-label="종목 정보">
              {INFO_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={infoTab === t.key}
                  onClick={() => setInfoTab(t.key)}
                  className={`-mb-px border-b-2 pb-2 font-semibold ${
                    infoTab === t.key ? "border-slate-100 text-slate-50" : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {infoTab === "info" && (
              <StockInfo stock={stock} config={config} candles={data.candles} earnings={data.earnings} today={today} />
            )}
            {infoTab === "earnings" && <EarningsPanel earnings={data.earnings} />}
            {infoTab === "news" && <StockFeed news={data.news} events={data.events} now={now} />}
          </Card>
        </div>

        {/* 오른쪽: 호가 · 체결 / 주문 · 미체결 · 잔고 */}
        <div className="grid min-w-0 items-start gap-3 max-lg:contents xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className={`min-w-0 space-y-3 ${show("book")}`}>
            <Card className="!rounded-2xl !p-3">
              <OrderBook
                book={data.book}
                price={stock.price}
                dayOpen={stock.day_open}
                config={config}
                myOrderPrices={myOrderPrices}
                onPick={pick}
              />
            </Card>
            <Card className="!rounded-2xl !p-3">
              <TradeTape trades={data.trades} dayOpen={stock.day_open} />
            </Card>
          </div>

          <div className={`min-w-0 space-y-3 ${show("order")}`}>
            <Card className="!rounded-2xl !p-3 sm:!p-4">
              <TradeForm stock={stock} config={config} picked={picked} sideRequest={sideRequest} onOrdered={data.reloadBook} />
            </Card>
            <Card className="!rounded-2xl !p-3 sm:!p-4">
              <OpenOrders stockId={stock.discord_id} onChanged={data.reloadBook} />
            </Card>
            <Card className="!rounded-2xl !p-3 sm:!p-4">
              <h3 className="mb-2 text-xs font-semibold text-slate-200">내 잔고</h3>
              <MyPosition stockId={stock.discord_id} price={stock.price} config={config} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 종목 이름 · 현재가 · 등락 · 요약 시세 */
function QuoteHeader({ stock, config, volume }: { stock: LiveStock; config: MarketConfig; volume: number | null }) {
  const diff = stock.price - stock.day_open;
  const ratio = changeRatio(stock.price, stock.day_open);
  const tone = diff > 0 ? "text-rise" : diff < 0 ? "text-fall" : "text-slate-100";
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "";
  const bounds = priceBounds(config, stock.day_open);
  const atLimit = stock.price === bounds.hi ? "상한가" : stock.price === bounds.lo && stock.price > config.min_price ? "하한가" : null;

  return (
    <header className="panel flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-2xl p-3 animate-fade-up sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <StockAvatar name={stock.display_name} house={stock.house} size="lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="truncate text-xl font-bold text-slate-50 sm:text-2xl">{stock.display_name}</h1>
            <HouseBadge house={stock.house} />
            <ViBadge viUntil={stock.vi_until} />
            {atLimit && (
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${atLimit === "상한가" ? "bg-rise/20 text-rise" : "bg-fall/20 text-fall"}`}>
                {atLimit}
              </span>
            )}
          </div>
          <div key={stock.flashKey} className={`mt-1 inline-flex flex-wrap items-baseline gap-x-2 rounded-md ${stock.flashKey > 0 ? `flash-${stock.flash}` : ""}`}>
            <span className={`text-[1.75rem] font-bold leading-none tabular-nums tracking-tight sm:text-[2rem] ${tone}`}>
              {formatGalleon(stock.price)}
            </span>
            <span className={`text-sm font-semibold tabular-nums ${tone}`}>
              {arrow} {formatGalleon(Math.abs(diff))} ({formatPct(ratio)})
            </span>
            <HelpTip term="등락률" />
          </div>
        </div>
      </div>
      <dl className="grid w-full grid-cols-4 gap-x-3 text-[11px] sm:w-auto sm:gap-x-5">
        <Stat label={<Term k="기준가" />} value={formatGalleon(stock.day_open)} />
        <Stat label={<Term k="상한가" />} value={formatGalleon(bounds.hi)} cls="text-rise" />
        <Stat label={<Term k="하한가" />} value={formatGalleon(bounds.lo)} cls="text-fall" />
        <Stat label={<Term k="거래량" />} value={volume === null ? "-" : formatKoreanUnit(volume)} />
      </dl>
    </header>
  );
}

function Stat({ label, value, cls = "text-slate-200" }: { label: React.ReactNode; value: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`truncate font-semibold tabular-nums ${cls}`}>{value}</dd>
    </div>
  );
}
