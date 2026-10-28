// 매매 미리보기·에러 매핑 등 순수 로직.
// previewTrade 는 SQL public._quote / public._execute 와 같은 결과를 내야 한다. 부동소수점
// 오차로 반올림이 어긋나지 않도록 비율은 백만분율 정수(BigInt), 가격은 유리수(분자/분모)로 계산한다.

import type { Json, MarketConfig } from "@/lib/database.types";

export type TradeSide = "buy" | "sell";
/** cash: 현금 · credit: 신용 · short: 공매도 */
export type Position = "cash" | "credit" | "short";

export type TradeConfig = Pick<
  MarketConfig,
  | "fee_rate"
  | "sell_tax_rate"
  | "min_price"
  | "trade_impact"
  | "max_trade_impact"
  | "max_trade_qty"
  | "price_limit_rate"
  | "credit_margin_rate"
  | "short_margin_rate"
>;

export type TradeErrorCode =
  | "insufficient_cash"
  | "insufficient_shares"
  | "insufficient_short"
  | "self_trade"
  | "bad_qty"
  | "bad_price"
  | "no_stock"
  | "no_order"
  | "not_logged_in"
  | "bad_side"
  | "bad_position"
  | "not_member"
  | "vi_halt"
  | "credit_limit"
  | "limit_cash_only";

export type TradePreview = {
  /** 가격 충격 비율 (예: 0.004) */
  impact: number;
  /** 체결가 (충격 전후 가격의 중간 · 호가 단위) */
  execPrice: number;
  /** 체결 후 새 주가 */
  newPrice: number;
  /** 체결 금액 = 체결가 × 수량 */
  gross: number;
  fee: number;
  /** 증권거래세 (매도만) */
  tax: number;
  /** 신용매수 대출금 */
  loan: number;
  /** 공매도 보증금 */
  margin: number;
  /** 계좌 현금 변화 (음수면 빠져나감) */
  cashDelta: number;
  /** 서버에서 거절될 것이 확실한 경우의 코드 */
  error: TradeErrorCode | null;
};

const MICRO = BigInt(1_000_000);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

const toMicro = (n: number) => BigInt(Math.round(n * 1_000_000));

const absBig = (n: bigint) => (n < ZERO ? -n : n);
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

// ───────────────────────────── 호가 단위 · 가격 제한 ─────────────────────────────

const TICK_TABLE: [number, number][] = [
  [2000, 1],
  [5000, 5],
  [20000, 10],
  [50000, 50],
  [200000, 100],
  [500000, 500],
];

/** 한국거래소 호가 단위 (SQL tick_size) */
export function tickSize(price: number): number {
  for (const [below, tick] of TICK_TABLE) if (price < below) return tick;
  return 1000;
}

/** 유리수 num/den 의 호가 단위 */
function tickOf(num: bigint, den: bigint): bigint {
  for (const [below, tick] of TICK_TABLE) if (num < BigInt(below) * den) return BigInt(tick);
  return BigInt(1000);
}

type Rounding = "round" | "floor" | "ceil";

/** 유리수 num/den 을 호가 단위로 맞춘다. den > 0, 결과는 정수 갈레온 */
function tickRational(num: bigint, den: bigint, mode: Rounding): bigint {
  const t = tickOf(num, den);
  const d = den * t;
  const q = mode === "round" ? roundDiv(num, d) : mode === "floor" ? floorDiv(num, d) : ceilDiv(num, d);
  return q * t;
}

export function roundTick(price: number): number {
  return Number(tickRational(toMicro(price), MICRO, "round"));
}

/** 기준가에서 하한가 · 상한가 (SQL price_bounds) */
export function priceBounds(
  cfg: Pick<TradeConfig, "min_price" | "price_limit_rate">,
  dayOpen: number,
): { lo: number; hi: number } {
  const open = toMicro(dayOpen);
  const rate = toMicro(cfg.price_limit_rate);
  const den = MICRO * MICRO;
  const lo = tickRational(open * (MICRO - rate), den, "ceil");
  const hi = tickRational(open * (MICRO + rate), den, "floor");
  return { lo: Math.max(cfg.min_price, Number(lo)), hi: Number(hi) };
}

export function isValidQty(qty: number, cfg: Pick<TradeConfig, "max_trade_qty">): boolean {
  return Number.isInteger(qty) && qty >= 1 && qty <= cfg.max_trade_qty;
}

/** SQL _quote 미러: 시장가 체결 견적 */
export function quote(
  cfg: TradeConfig,
  price: number,
  dayOpen: number,
  side: TradeSide,
  qty: number,
): { impact: number; execPrice: number; newPrice: number; gross: number } {
  const impact = minBig(toMicro(cfg.max_trade_impact), toMicro(cfg.trade_impact) * BigInt(qty));
  const p = toMicro(price);
  const target = tickRational(p * (side === "buy" ? MICRO + impact : MICRO - impact), MICRO * MICRO, "round");
  const { lo, hi } = priceBounds(cfg, dayOpen);
  const newPrice = Math.min(hi, Math.max(lo, Number(target)));
  const exec = tickRational(p + toMicro(newPrice), TWO * MICRO, "round");
  return {
    impact: Number(impact) / 1_000_000,
    execPrice: Number(exec),
    newPrice,
    gross: Number(exec) * qty,
  };
}

const ceilRate = (amount: number, rate: number) =>
  Number(ceilDiv(BigInt(amount) * toMicro(rate), MICRO));

/**
 * SQL _execute 미러. 계좌 현금이 얼마나 바뀌는지까지 계산한다.
 *   매수 수수료 max(1, ceil(gross*fee_rate)) · 매도는 수수료 + 거래세 ceil(gross*sell_tax_rate)
 *   신용매수: 보증금 ceil(gross*credit_margin_rate) + 수수료 만 현금에서, 나머지는 대출
 *   신용상환(매도): 매도대금 − 수수료 − 세금 − 대출 상환분
 *   공매도: 보증금 ceil(gross*short_margin_rate) 를 현금에서 담보로
 *   공매도 상환(매수): 담보 해제분 − 매수대금 − 수수료
 * position 이 credit/short 이고 청산 쪽이면 opts.position* 로 그 포지션을 넘긴다.
 */
export function previewTrade(
  cfg: TradeConfig,
  price: number,
  dayOpen: number,
  side: TradeSide,
  qty: number,
  opts: {
    position?: Position;
    cash?: number;
    /** 매도 가능한 현금 보유 수량 (예약 수량 제외) */
    heldQty?: number;
    /** 신용 · 공매도 포지션 (청산할 때) */
    positionQty?: number;
    positionLoan?: number;
    positionCollateral?: number;
  } = {},
): TradePreview {
  const position = opts.position ?? "cash";
  const empty: TradePreview = {
    impact: 0, execPrice: price, newPrice: price, gross: 0, fee: 0, tax: 0, loan: 0, margin: 0, cashDelta: 0,
    error: "bad_qty",
  };
  if (!isValidQty(qty, cfg)) return empty;

  const q = quote(cfg, price, dayOpen, side, qty);
  let fee = Math.max(1, ceilRate(q.gross, cfg.fee_rate));
  let tax = 0;
  if (side === "sell") {
    fee = Math.min(q.gross, fee);
    tax = Math.min(q.gross - fee, ceilRate(q.gross, cfg.sell_tax_rate));
  }

  let cashDelta = 0;
  let loan = 0;
  let margin = 0;
  let error: TradeErrorCode | null = null;
  const posQty = opts.positionQty ?? 0;

  if (position === "cash") {
    cashDelta = side === "buy" ? -(q.gross + fee) : q.gross - fee - tax;
    if (side === "sell" && opts.heldQty !== undefined && opts.heldQty < qty) error = "insufficient_shares";
  } else if (position === "credit" && side === "buy") {
    const own = ceilRate(q.gross, cfg.credit_margin_rate) + fee;
    loan = q.gross + fee - own;
    cashDelta = -own;
  } else if (position === "credit") {
    if (posQty < qty) error = "insufficient_shares";
    const posLoan = opts.positionLoan ?? 0;
    const repay = posQty === qty ? posLoan : posQty > 0 ? Number(roundDiv(BigInt(posLoan) * BigInt(qty), BigInt(posQty))) : 0;
    cashDelta = q.gross - fee - tax - repay;
  } else if (side === "sell") {
    margin = ceilRate(q.gross, cfg.short_margin_rate);
    cashDelta = -margin;
  } else {
    if (posQty < qty) error = "insufficient_short";
    const col = opts.positionCollateral ?? 0;
    const release = posQty === qty ? col : posQty > 0 ? Number(roundDiv(BigInt(col) * BigInt(qty), BigInt(posQty))) : 0;
    cashDelta = release - q.gross - fee;
  }

  if (!error && cashDelta < 0 && opts.cash !== undefined && Math.floor(opts.cash) < -cashDelta) {
    error = "insufficient_cash";
  }

  return { ...q, fee, tax, loan, margin, cashDelta, error };
}

/** 담보비율 경고 단계: 유지 기준 × 이 값 미만이면 위험 · 주의 */
export const MARGIN_DANGER = 1.1;
export const MARGIN_WARN = 1.3;

/** 지정가 매수 주문에 묶이는 갈레온 (SQL place_order) */
export function limitBuyReserve(cfg: Pick<TradeConfig, "fee_rate">, limit: number, qty: number): number {
  const amount = limit * qty;
  return amount + Math.max(1, ceilRate(amount, cfg.fee_rate));
}

/** 현재 잔고로 살 수 있는 최대 수량 (max_trade_qty 이내). */
export function maxAffordableQty(
  cfg: TradeConfig,
  price: number,
  dayOpen: number,
  cash: number,
  position: Position = "cash",
): number {
  const side: TradeSide = position === "short" ? "sell" : "buy";
  let lo = 0;
  let hi = cfg.max_trade_qty;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (-previewTrade(cfg, price, dayOpen, side, mid, { position }).cashDelta <= cash) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ───────────────────────────── 에러 메시지 ─────────────────────────────

const ERROR_MESSAGES: Record<TradeErrorCode, string> = {
  insufficient_cash: "주문가능금액이 부족해요. 디스코드에서 /증권 입금 으로 계좌를 채워 주세요.",
  insufficient_shares: "매도 가능 수량보다 많이 팔 수는 없어요. 지정가 매도에 묶인 수량은 빠져요.",
  insufficient_short: "공매도한 수량보다 많이 갚을 수는 없어요.",
  self_trade: "자기 자신의 주식은 사고팔 수 없어요.",
  bad_qty: "수량이 올바르지 않아요.",
  bad_price: "지정가는 호가 단위에 맞고 상한가·하한가 안이어야 해요.",
  no_stock: "상장되지 않은 학생이에요.",
  no_order: "이미 체결됐거나 취소된 주문이에요.",
  not_logged_in: "로그인이 필요해요. 다시 로그인해 주세요.",
  bad_side: "매수/매도 구분이 올바르지 않아요.",
  bad_position: "주문 종류가 올바르지 않아요.",
  not_member: "기숙사에 배정된 학생이거나 /증권 입금 을 해야 거래할 수 있어요.",
  vi_halt: "변동성 완화장치(VI)가 발동돼 잠시 거래가 멈췄어요. 2분 뒤 다시 시도하거나 지정가로 주문해 주세요.",
  credit_limit: "신용 대출 한도를 넘었어요. 신용 잔고를 일부 갚은 뒤 다시 시도해 주세요.",
  limit_cash_only: "지정가 주문은 현금 매매만 가능해요. 신용·공매도는 시장가로 주문해 주세요.",
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
  const value = Math.floor(qty * price);
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

// ───────────────────────────── 스파크라인 ─────────────────────────────

/** 목록에 그리는 최근 주가 점 개수. */
export const SPARK_POINTS = 30;

/** 최근 주가에 새 값을 붙인다. 직전 값과 같으면 그대로, 길이는 max 로 자른다. */
export function appendSpark(series: readonly number[], price: number, max = SPARK_POINTS): number[] {
  if (series.length > 0 && series[series.length - 1] === price) return [...series];
  const next = [...series, price];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * 최근 주가 → SVG path (`M x y L x y …`). 점이 2개 미만이면 null.
 * 값이 모두 같으면 가운데 수평선. pad 는 선이 잘리지 않게 위아래 여백.
 */
export function sparklinePath(prices: readonly number[], width: number, height: number, pad = 2): string | null {
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min;
  const stepX = width / (prices.length - 1);
  const usable = height - pad * 2;
  return prices
    .map((p, i) => {
      const x = i * stepX;
      const y = span === 0 ? height / 2 : pad + usable - ((p - min) / span) * usable;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
