// 매매 미리보기·에러 매핑 등 순수 로직.
// previewTrade 는 SQL public.trade() 와 같은 결과를 내야 한다. 부동소수점 오차로 반올림이
// 어긋나지 않도록 가격은 센트(1/100), 비율은 백만분율 정수(BigInt)로 계산한다.

import type { Json, MarketConfig } from "@/lib/database.types";

export type TradeSide = "buy" | "sell";

export type TradeConfig = Pick<
  MarketConfig,
  "fee_rate" | "min_price" | "trade_impact" | "max_trade_impact" | "max_trade_qty"
>;

export type TradeErrorCode =
  | "insufficient_cash"
  | "insufficient_shares"
  | "self_trade"
  | "bad_qty"
  | "no_stock"
  | "not_logged_in"
  | "bad_side"
  | "not_member";

export type TradePreview = {
  /** 가격 충격 비율 (예: 0.004) */
  impact: number;
  /** 체결가 (충격 전후 가격의 중간) */
  execPrice: number;
  /** 체결 후 새 주가 */
  newPrice: number;
  /** 체결 금액 (매수: 올림, 매도: 내림) */
  gross: number;
  fee: number;
  /** 매수: 계좌에서 빠질 총액, 매도: 계좌로 들어올 금액 */
  total: number;
  /** 서버에서 거절될 것이 확실한 경우의 코드 */
  error: TradeErrorCode | null;
};

const MICRO = BigInt(1_000_000);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);

const toCents = (n: number) => BigInt(Math.round(n * 100));
const toMicro = (n: number) => BigInt(Math.round(n * 1_000_000));
const fromCents = (c: bigint) => Number(c) / 100;

const absBig = (n: bigint) => (n < ZERO ? -n : n);
const maxBig = (a: bigint, b: bigint) => (a > b ? a : b);
const minBig = (a: bigint, b: bigint) => (a < b ? a : b);

/** Postgres round(): 0.5 는 0에서 먼 쪽으로. den > 0 */
export function roundDiv(num: bigint, den: bigint): bigint {
  const q = (absBig(num) * TWO + den) / (TWO * den);
  return num < ZERO ? -q : q;
}

/** 올림 나눗셈. den > 0 */
export function ceilDiv(num: bigint, den: bigint): bigint {
  const q = num / den;
  return num % den !== ZERO && num > ZERO ? q + ONE : q;
}

/** 내림 나눗셈. den > 0 */
export function floorDiv(num: bigint, den: bigint): bigint {
  const q = num / den;
  return num % den !== ZERO && num < ZERO ? q - ONE : q;
}

export function isValidQty(qty: number, cfg: Pick<TradeConfig, "max_trade_qty">): boolean {
  return Number.isInteger(qty) && qty >= 1 && qty <= cfg.max_trade_qty;
}

/**
 * SQL trade() 미러.
 *   impact = min(max_trade_impact, trade_impact * qty)
 *   매수: exec = round(price*(1+impact/2), 2), new = round(price*(1+impact), 2)
 *         gross = ceil(exec*qty), fee = max(1, ceil(gross*fee_rate))
 *   매도: exec = round(price*(1-impact/2), 2), new = max(min_price, round(price*(1-impact), 2))
 *         gross = floor(exec*qty), fee = min(gross, max(1, ceil(gross*fee_rate)))
 * cash / heldQty 를 주면 잔고 부족도 미리 판정한다.
 */
export function previewTrade(
  cfg: TradeConfig,
  price: number,
  side: TradeSide,
  qty: number,
  opts: { cash?: number; heldQty?: number } = {},
): TradePreview {
  if (!isValidQty(qty, cfg)) {
    return { impact: 0, execPrice: price, newPrice: price, gross: 0, fee: 0, total: 0, error: "bad_qty" };
  }

  const q = BigInt(qty);
  const cents = toCents(price);
  const impactMicro = minBig(toMicro(cfg.max_trade_impact), toMicro(cfg.trade_impact) * q);
  const feeMicro = toMicro(cfg.fee_rate);
  const one = MICRO;

  let execCents: bigint;
  let newCents: bigint;
  let gross: bigint;
  let fee: bigint;

  if (side === "buy") {
    execCents = roundDiv(cents * (TWO * one + impactMicro), TWO * one);
    newCents = roundDiv(cents * (one + impactMicro), one);
    gross = ceilDiv(execCents * q, HUNDRED);
    fee = maxBig(ONE, ceilDiv(gross * feeMicro, one));
  } else {
    execCents = roundDiv(cents * (TWO * one - impactMicro), TWO * one);
    newCents = maxBig(toCents(cfg.min_price), roundDiv(cents * (one - impactMicro), one));
    gross = floorDiv(execCents * q, HUNDRED);
    fee = minBig(gross, maxBig(ONE, ceilDiv(gross * feeMicro, one)));
  }

  const total = side === "buy" ? gross + fee : gross - fee;

  let error: TradeErrorCode | null = null;
  if (side === "buy" && opts.cash !== undefined && BigInt(Math.floor(opts.cash)) < total) {
    error = "insufficient_cash";
  }
  if (side === "sell" && opts.heldQty !== undefined && opts.heldQty < qty) {
    error = "insufficient_shares";
  }

  return {
    impact: Number(impactMicro) / 1_000_000,
    execPrice: fromCents(execCents),
    newPrice: fromCents(newCents),
    gross: Number(gross),
    fee: Number(fee),
    total: Number(total),
    error,
  };
}

/** 현재 잔고로 살 수 있는 최대 수량 (max_trade_qty 이내). */
export function maxAffordableQty(cfg: TradeConfig, price: number, cash: number): number {
  let lo = 0;
  let hi = cfg.max_trade_qty;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (previewTrade(cfg, price, "buy", mid).total <= cash) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ───────────────────────────── 에러 메시지 ─────────────────────────────

const ERROR_MESSAGES: Record<TradeErrorCode, string> = {
  insufficient_cash: "갈레온이 부족해요. 디스코드에서 /증권 입금 으로 계좌를 채워 주세요.",
  insufficient_shares: "보유한 주식보다 많이 팔 수는 없어요.",
  self_trade: "자기 자신의 주식은 사고팔 수 없어요.",
  bad_qty: "수량이 올바르지 않아요.",
  no_stock: "상장되지 않은 학생이에요.",
  not_logged_in: "로그인이 필요해요. 다시 로그인해 주세요.",
  bad_side: "매수/매도 구분이 올바르지 않아요.",
  not_member: "서버에서 한 교시 이상 공부하거나 /증권 입금 을 해야 거래할 수 있어요.",
};

const ERROR_CODES = Object.keys(ERROR_MESSAGES) as TradeErrorCode[];

/** RPC 에러(PostgrestError 등)에서 trade() 가 raise 한 코드를 찾는다. */
export function tradeErrorCode(err: unknown): TradeErrorCode | null {
  const message =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err && typeof err.message === "string"
        ? err.message
        : "";
  return ERROR_CODES.find((code) => message.includes(code)) ?? null;
}

export function tradeErrorMessage(err: unknown, cfg?: Pick<TradeConfig, "max_trade_qty">): string {
  const code = tradeErrorCode(err);
  if (code === "bad_qty" && cfg) {
    return `수량은 1주부터 ${cfg.max_trade_qty.toLocaleString("ko-KR")}주까지 가능해요.`;
  }
  if (code) return ERROR_MESSAGES[code];
  const message =
    err && typeof err === "object" && "message" in err && typeof err.message === "string" ? err.message : "";
  if (/failed to fetch|network/i.test(message)) {
    return "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.";
  }
  return "거래에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

// ───────────────────────────── 이벤트 ─────────────────────────────

/** SQL apply_market_event 와 같은 가중치: payload.weight 를 0~3 으로 자른 값, 기본 1 */
export function eventWeight(payload: Json): number {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return 1;
  const raw = payload.weight;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (raw === undefined || raw === null || Number.isNaN(n)) return 1;
  return Math.min(3, Math.max(0, n));
}

/** 이벤트가 주가에 준 영향 비율 (pct * weight). 알 수 없는 이벤트는 0. */
export function eventImpact(pct: number | undefined, payload: Json): number {
  return (pct ?? 0) * eventWeight(payload);
}

// ───────────────────────────── 보유 · 등락 ─────────────────────────────

export function changeRatio(price: number, base: number): number {
  if (!base) return 0;
  return (price - base) / base;
}

export type Direction = "up" | "down" | "flat";

export function direction(delta: number): Direction {
  if (delta > 1e-9) return "up";
  if (delta < -1e-9) return "down";
  return "flat";
}

/** 평가금액은 리더보드와 같이 floor(qty * price). */
export function holdingValuation(qty: number, costBasis: number, price: number) {
  const value = Number(floorDiv(toCents(price) * BigInt(qty), HUNDRED));
  const pnl = value - costBasis;
  return { value, pnl, pnlRatio: costBasis > 0 ? pnl / costBasis : 0 };
}

// ───────────────────────────── 차트 ─────────────────────────────

const KST_OFFSET_SEC = 9 * 60 * 60;

/**
 * price_ticks → 차트 점. lightweight-charts 는 UTC 로 표시하므로 KST 로 보이게 9시간 민다.
 * 같은 초에 여러 틱이 있으면 마지막 값만 남긴다 (시간은 엄격히 증가해야 한다).
 */
export function toChartPoints(
  ticks: { id: number; price: number; created_at: string }[],
  offsetSec = KST_OFFSET_SEC,
): { time: number; value: number }[] {
  const sorted = [...ticks].sort((a, b) => a.id - b.id);
  const out: { time: number; value: number }[] = [];
  for (const t of sorted) {
    const time = Math.floor(Date.parse(t.created_at) / 1000) + offsetSec;
    if (Number.isNaN(time)) continue;
    const last = out[out.length - 1];
    if (last && time <= last.time) {
      last.value = t.price;
    } else {
      out.push({ time, value: t.price });
    }
  }
  return out;
}
