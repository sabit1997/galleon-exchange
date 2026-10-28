"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { tradeKindLabel } from "@/components/news/news-kinds";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket } from "@/components/providers/market-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Empty, PageTitle, SkeletonRows, Spinner } from "@/components/ui/card";
import { ChangePct, Galleon, toneClass } from "@/components/ui/galleon";
import { kstDateTime, dayLabel } from "@/components/ui/kst";
import { TabBar } from "@/components/ui/tabs";
import { LearnHint, Tag, TermLink } from "@/components/ui/tag";
import type { DividendPayment, Order, Trade } from "@/lib/database.types";
import { HOUSE_STYLES, formatGalleon, formatSignedGalleon, houseKey } from "@/lib/format";
import { MARGIN_DANGER, MARGIN_WARN, tradeErrorMessage } from "@/lib/market";

type TabKey = "cash" | "credit" | "short" | "orders" | "trades" | "dividends";

const pctFmt = (ratio: number) => `${(ratio * 100).toFixed(0)}%`;

export function PortfolioView() {
  const { cash, holdings, credit, shorts, openOrders, reservedCash, loading, hasAccount } = useAccount();
  const { stocks, config } = useMarket();
  const [tab, setTab] = useState<TabKey>("cash");

  const priceOf = (id: string) => stocks.get(id)?.price ?? 0;

  const summary = useMemo(() => {
    const price = (id: string) => stocks.get(id)?.price ?? 0;
    let holdValue = 0;
    let holdCost = 0;
    for (const h of holdings.values()) {
      holdValue += Math.floor(h.qty * price(h.stock_id));
      holdCost += h.cost_basis;
    }
    let creditValue = 0;
    let creditLoan = 0;
    let creditOwn = 0;
    for (const c of credit.values()) {
      creditValue += Math.floor(c.qty * price(c.stock_id));
      creditLoan += c.loan;
      creditOwn += c.own_paid;
    }
    let shortLiability = 0;
    let shortCollateral = 0;
    let shortMargin = 0;
    for (const s of shorts.values()) {
      shortLiability += Math.ceil(s.qty * price(s.stock_id));
      shortCollateral += s.collateral;
      shortMargin += s.margin_paid;
    }
    // 명예의 전당(leaderboard RPC)과 같은 계산: 현금 + 주문에 묶인 돈 + 보유 평가 + 신용 순평가 + 공매도 순평가
    const total = cash + reservedCash + holdValue + (creditValue - creditLoan) + (shortCollateral - shortLiability);
    // 신용 · 공매도 손익은 내가 낸 돈 기준 (이자 · 수수료 · 세금 · 대차료 · 배당이 이미 반영된 대출금 · 담보로 계산)
    const pnl =
      holdValue - holdCost + (creditValue - creditLoan - creditOwn) + (shortCollateral - shortLiability - shortMargin);
    const base = holdCost + creditOwn + shortMargin;
    return { holdValue, creditValue, creditLoan, shortLiability, shortCollateral, total, pnl, base };
  }, [cash, reservedCash, holdings, credit, shorts, stocks]);

  if (loading) return <Spinner />;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "cash", label: "보유", count: holdings.size },
    { key: "credit", label: "신용", count: credit.size },
    { key: "short", label: "공매도", count: shorts.size },
    { key: "orders", label: "미체결", count: openOrders.length },
    { key: "trades", label: "체결내역" },
    { key: "dividends", label: "배당내역" },
  ];

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="잔고" title="내 계좌" subtitle="평가금액은 현재가 기준 추정치예요. 실제로 팔 땐 수수료 0.5% · 거래세 1% · 가격 충격이 빠져요." />

      {/* 요약 */}
      <section className="panel-glow rounded-2xl p-4 sm:p-5" aria-label="계좌 요약">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-[12.5px] font-medium text-slate-300">총자산 (추정)</p>
            <Galleon value={summary.total} className="gilded mt-0.5 block text-[2rem] font-extrabold leading-tight tracking-tight" />
          </div>
          {summary.base > 0 && (
            <div className="text-right">
              <p className="text-[12px] text-slate-400">
                평가손익 <TermLink id="pnl" />
              </p>
              <p className={`text-[17px] font-bold tabular-nums ${toneClass(summary.pnl)}`}>
                {formatSignedGalleon(summary.pnl)} <ChangePct ratio={summary.pnl / summary.base} className="text-[14px]" />
              </p>
            </div>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/8 pt-3 text-[13px] sm:grid-cols-4">
          <SummaryItem label="주문가능금액" value={<Galleon value={cash} className="text-gold-bright" />} />
          <SummaryItem label="주문에 묶인 금액" value={<Galleon value={reservedCash} />} hint="지정가 매수 주문이 미리 잡아 둔 갈레온" />
          <SummaryItem label="주식 평가금액" value={<Galleon value={summary.holdValue + summary.creditValue} />} />
          <SummaryItem
            label="신용 대출 · 공매도 상환"
            value={
              <span className="tabular-nums">
                {formatGalleon(summary.creditLoan)} · {formatGalleon(summary.shortLiability)}
              </span>
            }
            hint="갚아야 할 신용 대출금 · 공매도 주식을 지금 다시 사는 데 드는 금액"
          />
        </dl>
      </section>

      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl bg-gold/[0.05] px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-300 ring-1 ring-inset ring-gold/15">
        <span aria-hidden>🦉</span>
        입출금은 디스코드에서만 해요 —
        <code className="rounded bg-gold/10 px-1.5 py-0.5 font-semibold text-gold-bright">/증권 입금</code>
        <code className="rounded bg-gold/10 px-1.5 py-0.5 font-semibold text-gold-bright">/증권 출금</code>
        <span className="text-slate-500">(출금은 주문가능금액 안에서만 · 신용 대출금과 공매도 담보는 출금할 수 없어요)</span>
        {!hasAccount && <span className="w-full text-slate-400">아직 증권계좌가 없어요. 첫 입금을 하면 자동으로 만들어져요.</span>}
      </p>

      <section className="sheet overflow-hidden rounded-2xl">
        <TabBar label="잔고 구분" tabs={tabs} value={tab} onChange={setTab} />
        {tab === "cash" && <HoldingsTab priceOf={priceOf} />}
        {tab === "credit" && <CreditTab priceOf={priceOf} maintenance={config?.credit_maintenance ?? 1.4} />}
        {tab === "short" && <ShortTab priceOf={priceOf} maintenance={config?.short_maintenance ?? 1.2} />}
        {tab === "orders" && <OrdersTab />}
        {tab === "trades" && <TradesTab />}
        {tab === "dividends" && <DividendsTab />}
      </section>
    </div>
  );
}

function SummaryItem({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11.5px] text-slate-400" title={hint}>
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-50">{value}</dd>
    </div>
  );
}

// ───────────────────────────── 공통 표 조각 ─────────────────────────────

function StockCell({ id, sub }: { id: string; sub?: React.ReactNode }) {
  const { stocks, nameOf } = useMarket();
  const key = houseKey(stocks.get(id)?.house ?? null);
  return (
    <div className="flex max-w-[130px] flex-col gap-0.5 font-sans sm:max-w-[200px]">
      <Link
        href={`/stocks/${encodeURIComponent(id)}`}
        onClick={(e) => e.stopPropagation()}
        className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-slate-100 hover:underline"
      >
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${HOUSE_STYLES[key].dot}`} />
        <span className="truncate">{nameOf(id)}</span>
      </Link>
      {sub && <span className="truncate text-[11.5px] text-slate-500">{sub}</span>}
    </div>
  );
}

/** 두 줄 숫자 칸 (키움 잔고 화면처럼 위 · 아래) */
function Two({ top, bottom, className = "" }: { top: React.ReactNode; bottom: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-end gap-0.5 ${className}`}>
      <span className="text-[13px] text-slate-100">{top}</span>
      <span className="text-[11.5px] text-slate-500">{bottom}</span>
    </div>
  );
}

function Th({ top, bottom }: { top: string; bottom: string }) {
  return (
    <th scope="col">
      <span className="block">{top}</span>
      <span className="block text-slate-600">{bottom}</span>
    </th>
  );
}

function RowLink({ id, children }: { id: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr className="cursor-pointer" onClick={() => router.push(`/stocks/${encodeURIComponent(id)}`)}>
      {children}
    </tr>
  );
}

function MarginRatio({ ratio, maintenance }: { ratio: number; maintenance: number }) {
  const danger = ratio < maintenance * MARGIN_DANGER;
  const warn = ratio < maintenance * MARGIN_WARN;
  return (
    <span className="inline-flex items-center gap-1">
      {danger ? (
        <Tag tone="danger">위험</Tag>
      ) : warn ? (
        <Tag tone="warn">주의</Tag>
      ) : null}
      <span className={danger ? "font-bold text-rise" : warn ? "font-semibold text-[#fbbf24]" : "text-slate-100"}>
        {Number.isFinite(ratio) ? pctFmt(ratio) : "-"}
      </span>
    </span>
  );
}

// ───────────────────────────── 보유 (현금) ─────────────────────────────

function HoldingsTab({ priceOf }: { priceOf: (id: string) => number }) {
  const { holdings } = useAccount();
  const rows = [...holdings.values()]
    .map((h) => {
      const price = priceOf(h.stock_id);
      const value = Math.floor(h.qty * price);
      return { h, price, value, pnl: value - h.cost_basis };
    })
    .sort((a, b) => b.value - a.value);
  if (rows.length === 0) {
    return (
      <Empty>
        아직 보유한 주식이 없어요.{" "}
        <Link href="/" className="font-medium text-magic-bright underline underline-offset-4">
          시세 보러 가기
        </Link>
      </Empty>
    );
  }
  return (
    <>
      <div className="scroll-x">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="!pl-4 sm:!pl-5">
                종목명
                <span className="block text-slate-600">보유수량</span>
              </th>
              <Th top="평균단가" bottom="현재가" />
              <Th top="평가금액" bottom="매입금액" />
              <th scope="col" className="!pr-4 sm:!pr-5">
                평가손익
                <span className="block text-slate-600">수익률</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ h, price, value, pnl }) => (
              <RowLink key={h.stock_id} id={h.stock_id}>
                <td className="!pl-4 sm:!pl-5">
                  <StockCell
                    id={h.stock_id}
                    sub={
                      <>
                        {formatGalleon(h.qty)}주{h.reserved_qty > 0 && <span className="text-[#fbbf24]"> · 매도주문 {formatGalleon(h.reserved_qty)}</span>}
                      </>
                    }
                  />
                </td>
                <td>
                  <Two top={formatGalleon(Math.round(h.cost_basis / h.qty))} bottom={<span className={toneClass(price - h.cost_basis / h.qty)}>{formatGalleon(price)}</span>} />
                </td>
                <td>
                  <Two top={formatGalleon(value)} bottom={formatGalleon(h.cost_basis)} />
                </td>
                <td className="!pr-4 sm:!pr-5">
                  <Two
                    top={<span className={`font-semibold ${toneClass(pnl)}`}>{formatSignedGalleon(pnl)}</span>}
                    bottom={<ChangePct ratio={h.cost_basis ? pnl / h.cost_basis : 0} />}
                  />
                </td>
              </RowLink>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/5 p-3 sm:px-5">
        <LearnHint term="avg-price">
          평균단가는 수수료까지 포함한 1주당 산 값이에요. 왕복 비용(매수 0.5% + 매도 0.5% + 거래세 1%)이 약 2%라, 현재가가 평균단가보다 2% 넘게 올라야 실제로 남아요.
        </LearnHint>
      </div>
    </>
  );
}

// ───────────────────────────── 신용 ─────────────────────────────

function CreditTab({ priceOf, maintenance }: { priceOf: (id: string) => number; maintenance: number }) {
  const { credit } = useAccount();
  const rows = [...credit.values()]
    .map((c) => {
      const price = priceOf(c.stock_id);
      const value = Math.floor(c.qty * price);
      const ratio = c.loan > 0 ? value / c.loan : Infinity;
      return { c, price, value, ratio, pnl: value - c.loan - c.own_paid, forcePrice: c.loan > 0 ? (c.loan * maintenance) / c.qty : 0 };
    })
    .sort((a, b) => a.ratio - b.ratio);
  return (
    <>
      {rows.length === 0 ? (
        <Empty>신용으로 산 주식이 없어요.</Empty>
      ) : (
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="!pl-4 sm:!pl-5">
                  종목명
                  <span className="block text-slate-600">수량</span>
                </th>
                <Th top="평가금액" bottom="대출금" />
                <Th top="평가손익" bottom="수익률" />
                <th scope="col" className="!pr-4 sm:!pr-5">
                  담보비율
                  <span className="block text-slate-600">반대매매가</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, price, value, ratio, pnl, forcePrice }) => (
                <RowLink key={c.stock_id} id={c.stock_id}>
                  <td className="!pl-4 sm:!pl-5">
                    <StockCell id={c.stock_id} sub={`${formatGalleon(c.qty)}주 · 현재 ${formatGalleon(price)}`} />
                  </td>
                  <td>
                    <Two top={formatGalleon(value)} bottom={formatGalleon(c.loan)} />
                  </td>
                  <td>
                    <Two
                      top={<span className={`font-semibold ${toneClass(pnl)}`}>{formatSignedGalleon(pnl)}</span>}
                      bottom={<ChangePct ratio={c.own_paid ? pnl / c.own_paid : 0} />}
                    />
                  </td>
                  <td className="!pr-4 sm:!pr-5">
                    <Two top={<MarginRatio ratio={ratio} maintenance={maintenance} />} bottom={forcePrice ? `${formatGalleon(Math.ceil(forcePrice))} 미만` : "-"} />
                  </td>
                </RowLink>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-white/5 p-3 sm:px-5">
        <LearnHint term="credit">
          신용매수는 매수금액의 40%(+수수료)만 내고 나머지 60%를 빌려 사는 거예요. 대출금엔 매일 0.1% 이자가 붙고, 담보비율(평가금액 ÷ 대출금)이 {pctFmt(maintenance)} 아래로
          떨어지면 바로 <b className="font-semibold text-rise">반대매매</b>(강제 매도)돼요. 현재가가 반대매매가 근처면 조심하세요.
        </LearnHint>
      </div>
    </>
  );
}

// ───────────────────────────── 공매도 ─────────────────────────────

function ShortTab({ priceOf, maintenance }: { priceOf: (id: string) => number; maintenance: number }) {
  const { shorts } = useAccount();
  const rows = [...shorts.values()]
    .map((s) => {
      const price = priceOf(s.stock_id);
      const liability = Math.ceil(s.qty * price);
      const ratio = liability > 0 ? s.collateral / liability : Infinity;
      return {
        s,
        price,
        liability,
        ratio,
        avg: s.qty ? s.sell_value / s.qty : 0,
        pnl: s.collateral - liability - s.margin_paid,
        forcePrice: s.qty ? s.collateral / (s.qty * maintenance) : 0,
      };
    })
    .sort((a, b) => a.ratio - b.ratio);
  return (
    <>
      {rows.length === 0 ? (
        <Empty>공매도 중인 종목이 없어요.</Empty>
      ) : (
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="!pl-4 sm:!pl-5">
                  종목명
                  <span className="block text-slate-600">수량</span>
                </th>
                <Th top="평균공매도가" bottom="현재가" />
                <Th top="평가손익" bottom="수익률" />
                <Th top="담보" bottom="상환필요액" />
                <th scope="col" className="!pr-4 sm:!pr-5">
                  담보비율
                  <span className="block text-slate-600">강제상환가</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, price, liability, ratio, avg, pnl, forcePrice }) => (
                <RowLink key={s.stock_id} id={s.stock_id}>
                  <td className="!pl-4 sm:!pl-5">
                    <StockCell id={s.stock_id} sub={`${formatGalleon(s.qty)}주`} />
                  </td>
                  <td>
                    <Two top={formatGalleon(Math.round(avg))} bottom={<span className={toneClass(price - avg)}>{formatGalleon(price)}</span>} />
                  </td>
                  <td>
                    <Two
                      top={<span className={`font-semibold ${toneClass(pnl)}`}>{formatSignedGalleon(pnl)}</span>}
                      bottom={<ChangePct ratio={s.margin_paid ? pnl / s.margin_paid : 0} />}
                    />
                  </td>
                  <td>
                    <Two top={formatGalleon(s.collateral)} bottom={formatGalleon(liability)} />
                  </td>
                  <td className="!pr-4 sm:!pr-5">
                    <Two top={<MarginRatio ratio={ratio} maintenance={maintenance} />} bottom={forcePrice ? `${formatGalleon(Math.floor(forcePrice))} 초과` : "-"} />
                  </td>
                </RowLink>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-white/5 p-3 sm:px-5">
        <LearnHint term="short">
          공매도는 주식을 빌려 먼저 팔고, 나중에 싸게 다시 사서 갚는 거예요. 매도대금 + 보증금 50%가 담보로 묶이고 매일 대차료 0.05%가 빠져요. 주가가 올라 담보비율(담보 ÷ 상환필요액)이{" "}
          {pctFmt(maintenance)} 아래가 되면 강제로 되사서 갚아요 (반대매매). 주가는 끝없이 오를 수 있어 손실도 끝이 없어요.
        </LearnHint>
      </div>
    </>
  );
}

// ───────────────────────────── 미체결 ─────────────────────────────

function OrdersTab() {
  const { openOrders, refresh } = useAccount();
  const { supabase } = useMemberSession();
  const { config } = useMarket();
  const [pending, setPending] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cancel = async (o: Order) => {
    setPending(o.id);
    setMessage(null);
    const { error } = await supabase.rpc("cancel_order", { p_order_id: o.id });
    setPending(null);
    if (error) setMessage(tradeErrorMessage(error, config ?? undefined));
    else {
      setMessage("주문을 취소했어요. 묶여 있던 금액·수량이 풀렸어요.");
      await refresh();
    }
  };

  return (
    <>
      {message && (
        <p role="status" className="border-b border-white/5 px-4 py-2 text-[12.5px] text-slate-300 sm:px-5">
          {message}
        </p>
      )}
      {openOrders.length === 0 ? (
        <Empty>대기 중인 지정가 주문이 없어요.</Empty>
      ) : (
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="!pl-4 sm:!pl-5">
                  종목명
                  <span className="block text-slate-600">구분</span>
                </th>
                <Th top="주문가" bottom="수량" />
                <Th top="묶인 금액·수량" bottom="주문시각" />
                <th scope="col" className="!pr-4 sm:!pr-5">
                  <span className="sr-only">취소</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {openOrders.map((o) => (
                <tr key={o.id}>
                  <td className="!pl-4 sm:!pl-5">
                    <StockCell
                      id={o.stock_id}
                      sub={<span className={o.side === "buy" ? "text-rise" : "text-fall"}>지정가 {o.side === "buy" ? "매수" : "매도"}</span>}
                    />
                  </td>
                  <td>
                    <Two top={formatGalleon(o.limit_price)} bottom={`${formatGalleon(o.qty)}주`} />
                  </td>
                  <td>
                    <Two top={o.side === "buy" ? <Galleon value={o.reserved_cash} /> : `${formatGalleon(o.qty)}주`} bottom={kstDateTime(o.created_at)} />
                  </td>
                  <td className="!pr-4 sm:!pr-5">
                    <button
                      type="button"
                      disabled={pending === o.id}
                      onClick={() => void cancel(o)}
                      className="pressable rounded-lg border border-white/12 px-2.5 py-1 font-sans text-[12px] font-semibold text-slate-200 hover:bg-white/8 disabled:opacity-50"
                    >
                      {pending === o.id ? "취소 중…" : "취소"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-white/5 p-3 sm:px-5">
        <LearnHint term="unfilled">
          지정가 주문은 원하는 가격이 올 때까지 기다리는 주문이에요. 매수는 주문가 × 수량 + 수수료만큼 갈레온이, 매도는 수량이 묶여요. 한 번에 전량만 체결되고, 오늘 00:00(KST)이
          지나면 자동으로 만료돼 묶인 게 풀려요.
        </LearnHint>
      </div>
    </>
  );
}

// ───────────────────────────── 체결내역 ─────────────────────────────

function TradesTab() {
  const { supabase, guildId, me } = useMemberSession();
  const { holdings, credit, shorts } = useAccount();
  const [rows, setRows] = useState<Trade[] | null>(null);

  // 계좌가 바뀔 때(체결 · 반대매매)마다 다시 읽는다
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("guild_id", guildId)
        .eq("owner_id", me)
        .order("id", { ascending: false })
        .limit(100);
      if (!cancelled) setRows(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, guildId, me, holdings, credit, shorts]);

  if (rows === null) return <SkeletonRows rows={4} />;
  if (rows.length === 0) return <Empty>아직 체결된 거래가 없어요.</Empty>;
  return (
    <>
      <div className="scroll-x">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="!pl-4 sm:!pl-5">
                종목명
                <span className="block text-slate-600">체결시각</span>
              </th>
              <Th top="구분" bottom="수량" />
              <Th top="체결가" bottom="체결금액" />
              <th scope="col" className="!pr-4 sm:!pr-5">
                수수료
                <span className="block text-slate-600">거래세</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="!pl-4 sm:!pl-5">
                  <StockCell id={t.stock_id} sub={kstDateTime(t.created_at)} />
                </td>
                <td>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="flex items-center gap-1 font-sans">
                      {t.forced && <Tag tone="danger">반대매매</Tag>}
                      {t.order_type === "limit" && <Tag>지정가</Tag>}
                      <span className={`text-[13px] font-semibold ${t.side === "buy" ? "text-rise" : "text-fall"}`}>{tradeKindLabel(t)}</span>
                    </span>
                    <span className="text-[11.5px] text-slate-500">{formatGalleon(t.qty)}주</span>
                  </div>
                </td>
                <td>
                  <Two top={formatGalleon(t.exec_price)} bottom={formatGalleon(t.gross)} />
                </td>
                <td className="!pr-4 sm:!pr-5">
                  <Two top={formatGalleon(t.fee)} bottom={t.tax ? formatGalleon(t.tax) : "-"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-white/5 px-4 py-2.5 text-[11.5px] text-slate-500 sm:px-5">
        최근 100건 · 수수료는 매수·매도 각각 0.5%, 거래세는 매도할 때만 1%예요.
      </p>
    </>
  );
}

// ───────────────────────────── 배당내역 ─────────────────────────────

function DividendsTab() {
  const { supabase, guildId, me } = useMemberSession();
  const [rows, setRows] = useState<DividendPayment[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("dividend_payments")
        .select("*")
        .eq("guild_id", guildId)
        .eq("owner_id", me)
        .order("id", { ascending: false })
        .limit(100);
      if (!cancelled) setRows(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, guildId, me]);

  const total = (rows ?? []).reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      {rows === null ? (
        <SkeletonRows rows={3} />
      ) : rows.length === 0 ? (
        <Empty>아직 받은 배당이 없어요. 매주 월요일 00:00에 지급돼요.</Empty>
      ) : (
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="!pl-4 sm:!pl-5">
                  종목명
                  <span className="block text-slate-600">지급일</span>
                </th>
                <Th top="주식 수" bottom="실적 주간" />
                <th scope="col" className="!pr-4 sm:!pr-5">
                  배당금
                  <span className="block text-slate-600">주당</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="!pl-4 sm:!pl-5">
                    <StockCell id={r.stock_id} sub={kstDateTime(r.created_at)} />
                  </td>
                  <td>
                    <Two
                      top={r.qty < 0 ? <span className="inline-flex items-center gap-1"><Tag tone="sky">공매도</Tag>{formatGalleon(-r.qty)}주</span> : `${formatGalleon(r.qty)}주`}
                      bottom={`${dayLabel(r.week_start)} 주`}
                    />
                  </td>
                  <td className="!pr-4 sm:!pr-5">
                    <Two
                      top={<span className={`font-semibold ${r.amount < 0 ? "text-fall" : "text-gold-bright"}`}>{formatSignedGalleon(r.amount)}</span>}
                      bottom={r.qty ? (Math.abs(r.amount) / Math.abs(r.qty)).toFixed(2) : "-"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="space-y-2 border-t border-white/5 p-3 sm:px-5">
        {rows && rows.length > 0 && (
          <p className="text-[12.5px] text-slate-400">
            누적 배당 <span className={`font-semibold tabular-nums ${total < 0 ? "text-fall" : "text-gold-bright"}`}>{formatSignedGalleon(total)}</span> 갈레온
          </p>
        )}
        <LearnHint term="dividend">
          지난주 걷힌 수수료·거래세의 절반을 공부시간 비율로 종목마다 나눠, 그 주식을 가진 사람(현금·신용)에게 줘요. 공매도 중이면 빌린 주식의 배당을 대신 내야 해서 담보에서 빠져요
          (마이너스로 표시).
        </LearnHint>
      </div>
    </>
  );
}
