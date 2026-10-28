"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket } from "@/components/providers/market-provider";
import { Card, Empty, PageTitle, SectionTitle, Spinner } from "@/components/ui/card";
import { ChangePct, Galleon, toneClass } from "@/components/ui/galleon";
import { HouseBadge, StockAvatar } from "@/components/ui/house-badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatPrice, formatSignedGalleon } from "@/lib/format";
import { holdingValuation } from "@/lib/market";

export function PortfolioView() {
  const { cash, holdings, loading, hasAccount } = useAccount();
  const { stocks, config } = useMarket();

  const rows = useMemo(
    () =>
      [...holdings.values()]
        .map((h) => {
          const stock = stocks.get(h.stock_id);
          const price = stock?.price ?? 0;
          return { holding: h, stock, price, ...holdingValuation(h.qty, h.cost_basis, price) };
        })
        .sort((a, b) => b.value - a.value),
    [holdings, stocks],
  );

  const stockValue = rows.reduce((sum, r) => sum + r.value, 0);
  const costTotal = rows.reduce((sum, r) => sum + r.holding.cost_basis, 0);
  const pnl = stockValue - costTotal;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="내 금고" title="내 계좌" subtitle="평가금액은 현재 주가 기준이에요. 실제 매도 시에는 가격 충격과 수수료가 반영돼요." />

      <section className="panel-glow rounded-3xl p-6 animate-fade-up">
        <p className="text-sm font-medium text-slate-300">총 자산</p>
        <Galleon value={cash + stockValue} className="gilded mt-1 block text-[2.25rem] font-extrabold leading-tight tracking-tight" />
        {costTotal > 0 && (
          <p className={`mt-1 text-sm font-medium tabular-nums ${toneClass(pnl)}`}>
            {formatSignedGalleon(pnl)} (<ChangePct ratio={pnl / costTotal} />)
            <span className="ml-1.5 text-slate-500">평가손익</span>
          </p>
        )}
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/8 pt-4">
          <div>
            <dt className="text-xs text-slate-400">현금 (증권계좌)</dt>
            <dd className="mt-1">
              <Galleon value={cash} className="text-lg font-bold text-slate-50" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">주식 평가금액</dt>
            <dd className="mt-1">
              <Galleon value={stockValue} className="text-lg font-bold text-slate-50" />
            </dd>
          </div>
        </dl>
      </section>

      <Card>
        <SectionTitle>갈레온 입출금은 디스코드에서</SectionTitle>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
          <li>
            <code className="mr-1 rounded-md bg-gold/10 px-1.5 py-0.5 font-semibold text-gold-bright">/증권 입금</code> 봇 지갑의 갈레온을 증권계좌로 옮겨요.
            {config && <> 하루 최대 {config.daily_deposit_cap.toLocaleString("ko-KR")} 갈레온까지 입금할 수 있어요.</>}
          </li>
          <li>
            <code className="mr-1 rounded-md bg-gold/10 px-1.5 py-0.5 font-semibold text-gold-bright">/증권 출금</code> 증권계좌의 갈레온을 봇 지갑으로 돌려받아요.
          </li>
        </ul>
        {!hasAccount && <p className="mt-3 text-sm text-slate-400">아직 증권계좌가 없어요. 첫 입금을 하면 자동으로 만들어져요.</p>}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <SectionTitle className="px-5 pt-5">보유 주식</SectionTitle>
        {rows.length === 0 ? (
          <Empty>
            아직 보유한 주식이 없어요.{" "}
            <Link href="/" className="font-medium text-magic-bright underline underline-offset-4">
              시장 둘러보기
            </Link>
          </Empty>
        ) : (
          <ul className="mt-2 divide-y divide-white/5">
            {rows.map(({ holding, stock, price, value, pnl: rowPnl, pnlRatio }) => (
              <li key={holding.stock_id}>
                <Link
                  href={`/stocks/${encodeURIComponent(holding.stock_id)}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.035] active:bg-white/[0.06] sm:px-5"
                >
                  <StockAvatar name={stock?.display_name ?? holding.stock_id} house={stock?.house ?? null} />
                  <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-slate-100">{stock?.display_name ?? holding.stock_id}</span>
                      {stock && <HouseBadge house={stock.house} />}
                    </div>
                    <Galleon value={value} className="text-right text-[15px] font-semibold text-slate-50" />
                    <p className="truncate text-xs text-slate-500 tabular-nums">
                      {holding.qty.toLocaleString("ko-KR")}주 · 평단 {formatPrice(holding.cost_basis / holding.qty)} → 현재 {formatPrice(price)}
                    </p>
                    <p className={`text-right text-xs font-medium tabular-nums ${toneClass(rowPnl)}`}>
                      {formatSignedGalleon(rowPnl)} (<ChangePct ratio={pnlRatio} />)
                    </p>
                  </div>
                  <ChevronRightIcon className="hidden shrink-0 text-slate-600 sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
