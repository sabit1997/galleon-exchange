"use client";

import { useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { GalleonCoin } from "@/components/ui/galleon";
import { HelpTip, Term, type GlossaryKey } from "@/components/stock/help-tip";
import { tickDown, tickUp } from "@/components/stock/chart-data";
import { formatCountdown, useViRemaining } from "@/components/stock/vi-badge";
import type { MarketConfig, PlaceOrderResult, Stock } from "@/lib/database.types";
import { formatGalleon, formatPct } from "@/lib/format";
import {
  isValidQty,
  limitBuyReserve,
  previewTrade,
  priceBounds,
  roundTick,
  tradeErrorMessage,
  type Position,
  type TradeErrorCode,
  type TradeSide,
} from "@/lib/market";

type OrderType = "market" | "limit";
type Feedback = { kind: "ok" | "error"; text: string } | null;

/** 호가창에서 고른 가격. nonce 가 바뀔 때마다 지정가로 채운다 */
export type PickedPrice = { price: number; nonce: number };
/** 바깥(모바일 매수/매도 버튼)에서 탭을 바꿀 때. nonce 가 바뀔 때마다 반영한다 */
export type SideRequest = { side: TradeSide; nonce: number };

const MODES: { key: Position; label: string }[] = [
  { key: "cash", label: "현금" },
  { key: "credit", label: "신용" },
  { key: "short", label: "공매도" },
];

/** 매수/매도 탭 × 현금/신용/공매도 → 실제 주문 이름 */
function orderName(side: TradeSide, mode: Position): string {
  if (mode === "credit") return side === "buy" ? "신용매수" : "신용상환";
  if (mode === "short") return side === "sell" ? "공매도" : "공매도 상환";
  return side === "buy" ? "매수" : "매도";
}

const MODE_HINT: Record<Position, Record<TradeSide, string>> = {
  cash: {
    buy: "내 돈으로 주식을 사요. 가장 기본적인 주문이에요.",
    sell: "갖고 있는 주식을 팔아요. 팔 때는 수수료와 거래세가 붙어요.",
  },
  credit: {
    buy: "체결금액의 40%만 내고 60%는 빌려서 사요. 오르면 수익이 커지지만 내리면 손실도 커져요.",
    sell: "신용으로 산 주식을 팔아 대출을 갚아요. 남은 돈이 주문가능금액으로 들어와요.",
  },
  short: {
    sell: "주식을 빌려 먼저 팔아요. 나중에 싸게 되사서 갚으면 그 차이만큼 이익이에요.",
    buy: "공매도한 주식을 되사서 갚아요. 판 가격보다 싸게 사면 이익이에요.",
  },
};

/** 주문 전 미리 계산한 내용 */
type Draft = {
  error: TradeErrorCode | null;
  /** 시장가: 체결 예상가 · 지정가: 지정가 */
  unitPrice: number;
  gross: number;
  fee: number;
  tax: number;
  loan: number;
  margin: number;
  /** 주문 즉시 주문가능금액 변화 */
  cashDelta: number;
  /** 시장가 체결 후 주가 */
  newPrice: number | null;
  /** 지정가 매도가 체결되면 받을 금액 */
  proceeds: number | null;
  /** 신용상환 · 공매도 상환에서 갚는(풀리는) 금액 */
  settle: number;
};

const ceilRate = (amount: number, rate: number) => {
  const r = Math.round(rate * 1_000_000);
  return Math.floor((amount * r + 999_999) / 1_000_000);
};

/** pred 가 참인 가장 큰 수량 (pred 는 수량에 대해 단조) */
function searchMax(limit: number, pred: (q: number) => boolean): number {
  let lo = 0;
  let hi = limit;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (pred(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function TradeForm({
  stock,
  config,
  picked,
  sideRequest,
  onOrdered,
}: {
  stock: Stock;
  config: MarketConfig;
  picked?: PickedPrice | null;
  sideRequest?: SideRequest | null;
  /** 주문이 들어간 뒤 (호가 다시 읽기 등) */
  onOrdered?: () => void;
}) {
  const { supabase, guildId, me } = useMemberSession();
  const { cash, holdings, credit, shorts, refresh } = useAccount();
  const [side, setSide] = useState<TradeSide>("buy");
  const [mode, setMode] = useState<Position>("cash");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [priceText, setPriceText] = useState(() => String(stock.price));
  const [qtyText, setQtyText] = useState("1");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [seenPick, setSeenPick] = useState(picked?.nonce ?? 0);
  const [seenSide, setSeenSide] = useState(sideRequest?.nonce ?? 0);
  const viLeft = useViRemaining(stock.vi_until);

  if (sideRequest && sideRequest.nonce !== seenSide) {
    setSeenSide(sideRequest.nonce);
    setSide(sideRequest.side);
  }

  // 호가창에서 가격을 고르면 현금 지정가로 바꾼다 (렌더 중 상태 맞추기)
  if (picked && picked.nonce !== seenPick) {
    setSeenPick(picked.nonce);
    setMode("cash");
    setOrderType("limit");
    setPriceText(String(picked.price));
    setFeedback(null);
  }

  if (stock.discord_id === me) {
    return (
      <div className="space-y-2 rounded-xl bg-white/[0.04] p-4 text-sm leading-relaxed text-slate-300 ring-1 ring-inset ring-white/6">
        <p className="font-semibold text-slate-100">🪞 자기 주식은 주문할 수 없어요</p>
        <p className="text-xs text-slate-400">
          실제 시장에서도 회사 내부자의 자사주 매매는 엄격히 제한돼요. 열심히 공부해서 실적(공부시간)으로 주가를 올려 보세요!
        </p>
      </div>
    );
  }

  const holding = holdings.get(stock.discord_id);
  const sellable = holding ? holding.qty - holding.reserved_qty : 0;
  const cp = credit.get(stock.discord_id);
  const sp = shorts.get(stock.discord_id);
  const usedLoan = [...credit.values()].reduce((s, c) => s + c.loan, 0);
  const loanRoom = Math.max(0, config.credit_max_loan - usedLoan);
  const bounds = priceBounds(config, stock.day_open);
  const type: OrderType = mode === "cash" ? orderType : "market";
  const limitPrice = Number(priceText);
  const viBlocked = type === "market" && viLeft > 0;

  const draft = (q: number): Draft => {
    if (type === "market") {
      const p = previewTrade(config, stock.price, stock.day_open, side, q, {
        position: mode,
        cash,
        heldQty: sellable,
        positionQty: mode === "credit" ? (cp?.qty ?? 0) : (sp?.qty ?? 0),
        positionLoan: cp?.loan ?? 0,
        positionCollateral: sp?.collateral ?? 0,
      });
      let error = p.error;
      if (!error && mode === "credit" && side === "buy" && p.loan > loanRoom) error = "credit_limit";
      const settle =
        mode === "credit" && side === "sell"
          ? p.gross - p.fee - p.tax - p.cashDelta
          : mode === "short" && side === "buy"
            ? p.cashDelta + p.gross + p.fee
            : 0;
      return {
        error,
        unitPrice: p.execPrice,
        gross: p.gross,
        fee: p.fee,
        tax: p.tax,
        loan: p.loan,
        margin: p.margin,
        cashDelta: p.cashDelta,
        newPrice: p.newPrice,
        proceeds: null,
        settle,
      };
    }
    // 지정가 (현금만)
    const okPrice = Number.isInteger(limitPrice) && limitPrice > 0 && roundTick(limitPrice) === limitPrice && limitPrice >= bounds.lo && limitPrice <= bounds.hi;
    const gross = okPrice ? limitPrice * q : 0;
    let fee = gross > 0 ? Math.max(1, ceilRate(gross, config.fee_rate)) : 0;
    let tax = 0;
    if (side === "sell") {
      fee = Math.min(gross, fee);
      tax = Math.min(gross - fee, ceilRate(gross, config.sell_tax_rate));
    }
    const reserve = side === "buy" && okPrice ? limitBuyReserve(config, limitPrice, q) : 0;
    let error: TradeErrorCode | null = null;
    if (!isValidQty(q, config)) error = "bad_qty";
    else if (!okPrice) error = "bad_price";
    else if (side === "buy" && reserve > Math.floor(cash)) error = "insufficient_cash";
    else if (side === "sell" && q > sellable) error = "insufficient_shares";
    return {
      error,
      unitPrice: okPrice ? limitPrice : 0,
      gross,
      fee,
      tax,
      loan: 0,
      margin: 0,
      cashDelta: -reserve,
      newPrice: null,
      proceeds: side === "sell" ? gross - fee - tax : null,
      settle: 0,
    };
  };

  const qty = qtyText === "" ? 0 : Number(qtyText);
  const d = draft(qty);
  const maxQty = searchMax(config.max_trade_qty, (q) => draft(q).error === null);
  const name = orderName(side, mode);
  const isBuy = side === "buy";
  const modeTerm: GlossaryKey | undefined =
    mode === "credit" ? (isBuy ? "신용" : "신용상환") : mode === "short" ? (isBuy ? "공매도상환" : "공매도") : undefined;

  const setPct = (pct: number) => {
    if (maxQty < 1) return;
    setQtyText(String(Math.max(1, Math.floor(maxQty * pct))));
  };
  const stepPrice = (dir: 1 | -1) => {
    const base = Number.isFinite(limitPrice) && limitPrice > 0 ? roundTick(limitPrice) : stock.price;
    const next = dir > 0 ? tickUp(base) : tickDown(base);
    setPriceText(String(Math.min(bounds.hi, Math.max(bounds.lo, next))));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (d.error || pending || viBlocked) return;
    setPending(true);
    setFeedback(null);
    const { data, error } = await supabase.rpc("place_order", {
      p_guild: guildId,
      p_stock: stock.discord_id,
      p_side: side,
      p_qty: qty,
      p_position: mode,
      p_limit: type === "limit" ? limitPrice : null,
    });
    setPending(false);
    if (error) {
      setFeedback({ kind: "error", text: tradeErrorMessage(error, config) });
      return;
    }
    const r = data as unknown as PlaceOrderResult;
    const q = qty.toLocaleString("ko-KR");
    if ("trade_id" in r) {
      setFeedback({
        kind: "ok",
        text: `${stock.display_name} ${q}주 ${name} 체결 · 체결가 ${formatGalleon(r.exec_price)} · 수수료 ${formatGalleon(r.fee)}${r.tax ? ` · 거래세 ${formatGalleon(r.tax)}` : ""} 갈레온`,
      });
    } else if (r.status === "filled") {
      setFeedback({ kind: "ok", text: `지정가 ${name} ${q}주가 바로 체결됐어요 (주문번호 ${r.order_id}).` });
    } else {
      setFeedback({
        kind: "ok",
        text: `지정가 ${name} ${q}주 @ ${formatGalleon(limitPrice)} 접수 (주문번호 ${r.order_id}). 가격이 닿으면 자동 체결되고, 오늘 자정까지 유효해요.`,
      });
    }
    void refresh();
    onOrdered?.();
  };

  const sideTab = (s: TradeSide) =>
    `flex-1 py-2.5 text-sm font-bold transition-colors ${
      side === s
        ? s === "buy"
          ? "border-b-2 border-rise text-rise"
          : "border-b-2 border-fall text-fall"
        : "border-b border-white/8 text-slate-500 hover:text-slate-300"
    }`;
  const chip = (active: boolean) =>
    `flex-1 rounded-md py-1.5 text-xs font-semibold ${active ? "bg-white/12 text-slate-50" : "text-slate-400 hover:text-slate-200"}`;

  // 화면에 보여줄 보유 정보
  const holdingLine =
    mode === "cash"
      ? side === "sell"
        ? { label: "매도가능", value: `${formatGalleon(sellable)}주`, term: undefined }
        : null
      : mode === "credit"
        ? side === "buy"
          ? { label: "신용한도 잔여", value: `${formatGalleon(loanRoom)} G`, term: "신용" as const }
          : { label: "신용잔고", value: `${formatGalleon(cp?.qty ?? 0)}주`, term: "신용상환" as const }
        : side === "buy"
          ? { label: "공매도잔고", value: `${formatGalleon(sp?.qty ?? 0)}주`, term: "공매도상환" as const }
          : null;

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <div className="flex" role="tablist" aria-label="매수 매도">
        <button type="button" role="tab" aria-selected={isBuy} className={sideTab("buy")} onClick={() => setSide("buy")}>
          매수
        </button>
        <button type="button" role="tab" aria-selected={!isBuy} className={sideTab("sell")} onClick={() => setSide("sell")}>
          매도
        </button>
      </div>

      <div className="flex gap-0.5 rounded-lg bg-white/[0.04] p-0.5" role="radiogroup" aria-label="거래 종류">
        {MODES.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} className={chip(mode === m.key)} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="flex items-start gap-1 text-[11px] leading-relaxed text-slate-400">
        <b className={`shrink-0 ${isBuy ? "text-rise" : "text-fall"}`}>{name}</b>
        <span>· {MODE_HINT[mode][side]}</span>
        {modeTerm && <HelpTip term={modeTerm} className="mt-0.5" />}
      </p>

      <div className="flex gap-0.5 rounded-lg bg-white/[0.04] p-0.5" role="radiogroup" aria-label="주문 방식">
        <button type="button" role="radio" aria-checked={type === "market"} className={chip(type === "market")} onClick={() => setOrderType("market")}>
          시장가
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={type === "limit"}
          disabled={mode !== "cash"}
          title={mode !== "cash" ? "지정가는 현금 매매만 가능해요" : undefined}
          className={`${chip(type === "limit")} disabled:cursor-not-allowed disabled:opacity-35`}
          onClick={() => {
            if (priceText === "" || !Number.isFinite(limitPrice)) setPriceText(String(stock.price));
            setOrderType("limit");
          }}
        >
          지정가
        </button>
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">
            <Term k="주문가능금액" />
          </dt>
          <dd className="font-semibold tabular-nums text-gold">
            {formatGalleon(cash)}
            <GalleonCoin />
          </dd>
        </div>
        {holdingLine && (
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">{holdingLine.term ? <Term k={holdingLine.term}>{holdingLine.label}</Term> : holdingLine.label}</dt>
            <dd className="font-medium tabular-nums text-slate-200">{holdingLine.value}</dd>
          </div>
        )}
      </dl>

      {/* 가격 */}
      <div>
        <label htmlFor="order-price" className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <Term k={type === "market" ? "시장가" : "지정가"}>가격</Term>
          {type === "limit" && (
            <span className="tabular-nums text-[11px] text-slate-500">
              하한 <span className="text-fall">{formatGalleon(bounds.lo)}</span> · 상한 <span className="text-rise">{formatGalleon(bounds.hi)}</span>
            </span>
          )}
        </label>
        {type === "market" ? (
          <div className="flex h-10 items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 text-slate-400">
            <span>시장가</span>
            <span className="tabular-nums text-slate-300">
              ≈ {formatGalleon(d.error === "bad_qty" ? stock.price : d.unitPrice)}
            </span>
          </div>
        ) : (
          <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-white/8 bg-white/[0.03]">
            <button type="button" aria-label="한 호가 내리기" onClick={() => stepPrice(-1)} className="w-10 shrink-0 text-lg text-slate-300 hover:bg-white/8">
              −
            </button>
            <input
              id="order-price"
              inputMode="numeric"
              autoComplete="off"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
              onBlur={() => {
                if (limitPrice > 0) setPriceText(String(Math.min(bounds.hi, Math.max(bounds.lo, roundTick(limitPrice)))));
              }}
              className="min-w-0 flex-1 bg-transparent text-center text-base font-semibold tabular-nums text-slate-50 outline-none"
            />
            <button type="button" aria-label="한 호가 올리기" onClick={() => stepPrice(1)} className="w-10 shrink-0 text-lg text-slate-300 hover:bg-white/8">
              +
            </button>
          </div>
        )}
      </div>

      {/* 수량 */}
      <div>
        <label htmlFor="order-qty" className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>수량</span>
          <span className="text-[11px] text-slate-500">
            최대 <b className="tabular-nums text-slate-300">{formatGalleon(maxQty)}</b>주
          </span>
        </label>
        <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-white/8 bg-white/[0.03]">
          <button
            type="button"
            aria-label="1주 빼기"
            onClick={() => setQtyText(String(Math.max(1, qty - 1)))}
            className="w-10 shrink-0 text-lg text-slate-300 hover:bg-white/8"
          >
            −
          </button>
          <input
            id="order-qty"
            inputMode="numeric"
            autoComplete="off"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            className="min-w-0 flex-1 bg-transparent text-center text-base font-semibold tabular-nums text-slate-50 outline-none"
          />
          <button
            type="button"
            aria-label="1주 더하기"
            onClick={() => setQtyText(String(Math.min(config.max_trade_qty, qty + 1)))}
            className="w-10 shrink-0 text-lg text-slate-300 hover:bg-white/8"
          >
            +
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {[
            [0.1, "10%"],
            [0.25, "25%"],
            [0.5, "50%"],
            [1, "최대"],
          ].map(([pct, label]) => (
            <button
              key={label}
              type="button"
              disabled={maxQty < 1}
              onClick={() => setPct(pct as number)}
              className="rounded-md bg-white/[0.05] py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10 disabled:opacity-35"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 미리보기 */}
      <dl className="space-y-1.5 rounded-lg bg-white/[0.03] p-3 text-xs ring-1 ring-inset ring-white/5">
        <Row label={type === "market" ? <Term k="체결예상가" /> : "주문가격"}>{d.unitPrice ? formatGalleon(d.unitPrice) : "-"}</Row>
        <Row label="주문금액">{formatGalleon(d.gross)}</Row>
        <Row label={<Term k="수수료">수수료 ({formatPct(config.fee_rate, 1).replace("+", "")})</Term>}>{formatGalleon(d.fee)}</Row>
        {side === "sell" && (
          <Row label={<Term k="거래세">거래세 ({formatPct(config.sell_tax_rate, 0).replace("+", "")})</Term>}>{formatGalleon(d.tax)}</Row>
        )}
        {mode === "credit" && side === "buy" && (
          <>
            <Row label="보증금 (내 돈 40%+수수료)">{formatGalleon(-d.cashDelta)}</Row>
            <Row label={<Term k="신용">신용 대출금</Term>}>{formatGalleon(d.loan)}</Row>
          </>
        )}
        {mode === "credit" && side === "sell" && <Row label="대출 상환">{formatGalleon(d.settle)}</Row>}
        {mode === "short" && side === "sell" && <Row label="보증금 (50%)">{formatGalleon(d.margin)}</Row>}
        {mode === "short" && side === "buy" && <Row label="담보 해제">{formatGalleon(d.settle)}</Row>}
        {type === "limit" && side === "buy" && <Row label="묶이는 금액">{formatGalleon(-d.cashDelta)}</Row>}
        {d.proceeds !== null && <Row label="체결 시 받을 금액">{formatGalleon(d.proceeds)}</Row>}
        {d.newPrice !== null && qty > 0 && (
          <Row label="체결 후 주가">
            {formatGalleon(d.newPrice)} <span className="text-slate-500">({formatPct(d.newPrice / stock.price - 1)})</span>
          </Row>
        )}
        <div className="!my-2 border-t border-white/8" />
        <Row label="주문 후 주문가능금액" strong>
          <span className="text-gold">{formatGalleon(Math.max(0, cash + d.cashDelta))}</span>
          <GalleonCoin />
        </Row>
      </dl>

      {type === "limit" && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          지정가 {isBuy ? "매수는 주문금액+수수료가" : "매도는 수량이"} 미리 묶여요. 가격이 닿으면 전량 한 번에 체결되고, 더 유리한 가격에 체결되면 차액은 돌려받아요. 오늘 자정(00:00)까지 유효해요.
        </p>
      )}

      {viBlocked && (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
          <Term k="VI">VI 발동 중</Term> — 시장가 주문은 <b className="tabular-nums">{formatCountdown(viLeft)}</b> 뒤에 가능해요. 지금은 현금 지정가 주문만 걸 수 있어요.
        </p>
      )}
      {d.error && qty > 0 && !viBlocked && (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">{tradeErrorMessage(d.error, config)}</p>
      )}

      <button
        type="submit"
        disabled={pending || d.error !== null || viBlocked}
        className={`pressable h-12 w-full rounded-xl text-[15px] font-bold text-white disabled:opacity-40 ${
          isBuy ? "bg-rise-deep hover:brightness-110" : "bg-fall-deep hover:brightness-110"
        }`}
      >
        {pending ? "주문 중…" : `${type === "market" ? "시장가" : "지정가"} ${name}`}
      </button>

      {feedback && (
        <p
          role="status"
          className={`animate-fade-up rounded-lg px-3 py-2 text-xs leading-relaxed ${feedback.kind === "ok" ? "bg-emerald-400/10 text-emerald-200" : "bg-red-400/10 text-red-200"}`}
        >
          {feedback.text}
        </p>
      )}
    </form>
  );
}

function Row({ label, children, strong = false }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${strong ? "font-semibold text-slate-100" : "text-slate-400"}`}>
      <dt>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "text-sm font-bold" : "text-slate-200"}`}>{children}</dd>
    </div>
  );
}
