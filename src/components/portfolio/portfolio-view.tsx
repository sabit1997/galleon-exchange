"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket } from "@/components/providers/market-provider";
import { Card, Empty, PageTitle, Spinner } from "@/components/ui/card";
import { ChangePct, Galleon, toneClass } from "@/components/ui/galleon";
import { HouseBadge } from "@/components/ui/house-badge";
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
      <PageTitle title="🗝️ 내 계좌" subtitle="평가금액은 현재 주가 기준이에요. 실제 매도 시에는 가격 충격과 수수료가 반영돼요." />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-gold/35">
          <p className="text-sm text-slate-400">총 자산</p>
          <Galleon value={cash + stockValue} className="mt-1 block text-2xl font-bold text-gold-bright" />
        </Card>
        <Card>
          <p className="text-sm text-slate-400">현금 (증권계좌)</p>
          <Galleon value={cash} className="mt-1 block text-2xl font-semibold" />
        </Card>
        <Card>
          <p className="text-sm text-slate-400">주식 평가금액</p>
          <Galleon value={stockValue} className="mt-1 block text-2xl font-semibold" />
          {costTotal > 0 && (
            <p className={`mt-1 text-sm tabular-nums ${toneClass(pnl)}`}>
              {formatSignedGalleon(pnl)} (<ChangePct ratio={pnl / costTotal} />)
            </p>
          )}
        </Card>
      </div>

      <Card className="border-gold/20 bg-gold/[0.04]">
        <h2 className="font-display font-semibold text-gold">🏦 갈레온 입출금은 디스코드에서</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          <li>
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-gold">/증권 입금</code> — 봇 지갑의 갈레온을 증권계좌로 옮겨요.
            {config && <> 하루 최대 {config.daily_deposit_cap.toLocaleString("ko-KR")} 갈레온까지 입금할 수 있어요.</>}
          </li>
          <li>
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-gold">/증권 출금</code> — 증권계좌의 갈레온을 봇 지갑으로 돌려받아요.
          </li>
        </ul>
        {!hasAccount && <p className="mt-2 text-sm text-slate-400">아직 증권계좌가 없어요. 첫 입금을 하면 자동으로 만들어져요.</p>}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <h2 className="font-display px-4 pt-4 font-semibold text-slate-100 sm:px-5">보유 주식</h2>
        {rows.length === 0 ? (
          <Empty>
            아직 보유한 주식이 없어요.{" "}
            <Link href="/" className="text-gold underline">
              시장 둘러보기
            </Link>
          </Empty>
        ) : (
          <ul className="mt-2 divide-y divide-gold/10">
            {rows.map(({ holding, stock, price, value, pnl: rowPnl, pnlRatio }) => (
              <li key={holding.stock_id}>
                <Link
                  href={`/stocks/${encodeURIComponent(holding.stock_id)}`}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 hover:bg-gold/[0.05] sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{stock?.display_name ?? holding.stock_id}</span>
                    {stock && <HouseBadge house={stock.house} />}
                  </div>
                  <Galleon value={value} className="text-right font-semibold" />
                  <p className="text-xs text-slate-400 tabular-nums">
                    {holding.qty.toLocaleString("ko-KR")}주 · 평단 {formatPrice(holding.cost_basis / holding.qty)} → 현재 {formatPrice(price)}
                  </p>
                  <p className={`text-right text-xs tabular-nums ${toneClass(rowPnl)}`}>
                    {formatSignedGalleon(rowPnl)} (<ChangePct ratio={pnlRatio} />)
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
