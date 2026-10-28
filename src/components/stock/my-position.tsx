"use client";

import { useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { ChangePct, toneClass } from "@/components/ui/galleon";
import type { MarketConfig, Order } from "@/lib/database.types";
import { formatGalleon, formatSignedGalleon } from "@/lib/format";
import { holdingValuation, MARGIN_DANGER, MARGIN_WARN, tradeErrorMessage } from "@/lib/market";
import { HelpTip, Term, type GlossaryKey } from "./help-tip";

const KST_MS = 9 * 60 * 60 * 1000;
const hhmm = (iso: string) => new Date(Date.parse(iso) + KST_MS).toISOString().slice(11, 16);

/** 이 종목의 내 잔고: 현금 보유 · 신용 · 공매도 */
export function MyPosition({ stockId, price, config }: { stockId: string; price: number; config: MarketConfig }) {
  const { holdings, credit, shorts, loading } = useAccount();
  const h = holdings.get(stockId);
  const cp = credit.get(stockId);
  const sp = shorts.get(stockId);

  if (loading) return <div className="skeleton h-24" role="status" aria-label="잔고 불러오는 중" />;
  if (!h && !cp && !sp) {
    return <p className="py-4 text-center text-xs text-slate-500">이 종목을 아직 갖고 있지 않아요.</p>;
  }

  return (
    <div className="space-y-2.5">
      {h && h.qty > 0 && (() => {
        const v = holdingValuation(h.qty, h.cost_basis, price);
        return (
          <Block title="현금 보유" tag="현금" tagClass="bg-white/8 text-slate-300">
            <Cell label={<Term k="평균단가" />}>{formatGalleon(Math.round(h.cost_basis / h.qty))}</Cell>
            <Cell label="보유수량">
              {formatGalleon(h.qty)}주{h.reserved_qty > 0 && <span className="text-slate-500"> (주문중 {formatGalleon(h.reserved_qty)})</span>}
            </Cell>
            <Cell label="평가금액">{formatGalleon(v.value)}</Cell>
            <Cell label="매입금액">{formatGalleon(h.cost_basis)}</Cell>
            <Cell label={<Term k="평가손익" />}>
              <span className={toneClass(v.pnl)}>{formatSignedGalleon(v.pnl)}</span>
            </Cell>
            <Cell label={<Term k="수익률" />}>
              <ChangePct ratio={v.pnlRatio} />
            </Cell>
          </Block>
        );
      })()}

      {cp && cp.qty > 0 && (() => {
        const value = Math.floor(cp.qty * price);
        // 내가 낸 돈(보증금 + 수수료) 기준. 대출금에는 그동안의 이자가 붙어 있다
        const pnl = value - cp.loan - cp.own_paid;
        const ratio = cp.loan > 0 ? value / cp.loan : Infinity;
        return (
          <Block title="신용 잔고" tag="신용" tagClass="bg-rise/15 text-rise">
            <Cell label={<Term k="평균단가" />}>{formatGalleon(Math.round(cp.cost_basis / cp.qty))}</Cell>
            <Cell label="보유수량">{formatGalleon(cp.qty)}주</Cell>
            <Cell label="평가금액">{formatGalleon(value)}</Cell>
            <Cell label="대출금">{formatGalleon(cp.loan)}</Cell>
            <Cell label={<Term k="평가손익" />}>
              <span className={toneClass(pnl)}>{formatSignedGalleon(pnl)}</span>
            </Cell>
            <Cell label={<Term k="수익률" />}>
              <ChangePct ratio={cp.own_paid > 0 ? pnl / cp.own_paid : 0} />
            </Cell>
            <MarginBar ratio={ratio} maintenance={config.credit_maintenance} term="담보비율" note={`평가금액 ÷ 대출금 · ${Math.round(config.credit_maintenance * 100)}% 미만이면 반대매매`} />
          </Block>
        );
      })()}

      {sp && sp.qty > 0 && (() => {
        const cover = Math.ceil(sp.qty * price);
        // 담보에는 매도 수수료 · 거래세 · 대차료 · 대신 낸 배당이 이미 빠져 있다
        const pnl = sp.collateral - cover - sp.margin_paid;
        const ratio = cover > 0 ? sp.collateral / cover : Infinity;
        return (
          <Block title="공매도 잔고" tag="공매도" tagClass="bg-fall/15 text-fall">
            <Cell label="평균 매도가">{formatGalleon(Math.round(sp.sell_value / sp.qty))}</Cell>
            <Cell label="공매도수량">{formatGalleon(sp.qty)}주</Cell>
            <Cell label="되사는 금액">{formatGalleon(cover)}</Cell>
            <Cell label="담보">{formatGalleon(sp.collateral)}</Cell>
            <Cell label={<Term k="평가손익" />}>
              <span className={toneClass(pnl)}>{formatSignedGalleon(pnl)}</span>
            </Cell>
            <Cell label={<Term k="수익률" />}>
              <ChangePct ratio={sp.margin_paid > 0 ? pnl / sp.margin_paid : 0} />
            </Cell>
            <MarginBar ratio={ratio} maintenance={config.short_maintenance} term="담보비율" note={`담보 ÷ 되사는 금액 · ${Math.round(config.short_maintenance * 100)}% 미만이면 강제 상환`} />
          </Block>
        );
      })()}
    </div>
  );
}

function Block({ title, tag, tagClass, children }: { title: string; tag: string; tagClass: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-inset ring-white/5">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
        <span className={`rounded px-1 py-px text-[10px] font-bold ${tagClass}`}>{tag}</span>
        {title}
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">{children}</dl>
    </section>
  );
}

function Cell({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-1">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="truncate text-right tabular-nums text-slate-200">{children}</dd>
    </div>
  );
}

/** 담보비율 막대. 유지 기준선까지 얼마나 남았는지 보여준다 */
function MarginBar({ ratio, maintenance, term, note }: { ratio: number; maintenance: number; term: GlossaryKey; note: string }) {
  const finite = Number.isFinite(ratio);
  const danger = finite && ratio < maintenance * MARGIN_DANGER;
  const warn = finite && ratio < maintenance * MARGIN_WARN;
  // 0% ~ 유지기준 × 2 를 막대 전체로
  const fill = finite ? Math.min(100, (ratio / (maintenance * 2)) * 100) : 100;
  return (
    <div className="col-span-2 mt-1">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">
          <Term k={term} />
        </span>
        <b className={`tabular-nums ${danger ? "text-red-300" : warn ? "text-amber-300" : "text-emerald-300"}`}>
          {finite ? `${Math.round(ratio * 100)}%` : "-"}
        </b>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/8">
        <i className={`absolute inset-y-0 left-0 rounded-full ${danger ? "bg-red-400" : warn ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${fill}%` }} />
        <i className="absolute inset-y-0 left-1/2 w-px bg-slate-200/70" title="유지 기준" />
      </div>
      <p className="mt-1 text-[10px] text-slate-500">{note}</p>
    </div>
  );
}

/** 이 종목의 미체결 지정가 주문 · 취소 */
export function OpenOrders({ stockId, onChanged }: { stockId: string; onChanged?: () => void }) {
  const { supabase } = useMemberSession();
  const { openOrders, refresh } = useAccount();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orders = openOrders.filter((o) => o.stock_id === stockId);

  const cancel = async (o: Order) => {
    setBusy(o.id);
    setError(null);
    const { error: err } = await supabase.rpc("cancel_order", { p_order_id: o.id });
    setBusy(null);
    if (err) setError(tradeErrorMessage(err));
    await refresh();
    onChanged?.();
  };

  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-200">
        미체결 <span className="tabular-nums text-slate-500">{orders.length}</span>
        <HelpTip term="미체결" />
      </h3>
      {orders.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-500">기다리는 지정가 주문이 없어요.</p>
      ) : (
        <ul className="divide-y divide-white/5 text-xs">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center gap-2 py-2">
              <span className={`shrink-0 rounded px-1 py-px text-[10px] font-bold ${o.side === "buy" ? "bg-rise/15 text-rise" : "bg-fall/15 text-fall"}`}>
                {o.side === "buy" ? "매수" : "매도"}
              </span>
              <span className="min-w-0 flex-1 tabular-nums">
                <b className="text-slate-100">{formatGalleon(o.limit_price)}</b>
                <span className="text-slate-400"> × {formatGalleon(o.qty)}주</span>
                <span className="block text-[10px] text-slate-500">
                  {hhmm(o.created_at)} 접수 · {o.side === "buy" ? `${formatGalleon(o.reserved_cash)} G 묶임` : `${formatGalleon(o.qty)}주 묶임`}
                </span>
              </span>
              <button
                type="button"
                disabled={busy === o.id}
                onClick={() => void cancel(o)}
                className="shrink-0 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/12 disabled:opacity-40"
              >
                {busy === o.id ? "취소 중" : "취소"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 rounded-md bg-red-400/10 px-2 py-1.5 text-[11px] text-red-200">{error}</p>}
    </div>
  );
}
