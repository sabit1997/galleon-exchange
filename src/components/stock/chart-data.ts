// 종목 화면 차트 · 호가창용 순수 계산. lightweight-charts 는 UTC 로 그리므로 분봉 시간은 KST 로 9시간 민다.

import { tickSize } from "@/lib/market";

export const KST_OFFSET_SEC = 9 * 60 * 60;

export type Bar = {
  /** 분봉: KST 로 민 초 단위 시각 · 일봉/주봉: 'YYYY-MM-DD' */
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TickLike = { id: number; price: number; created_at: string };
type TradeLike = { id: number; qty: number; created_at: string; exec_price: number };
type CandleLike = { day: string; open: number; high: number; low: number; close: number; volume: number };

/** ISO 시각 → KST 로 민 epoch 초 */
export function kstSeconds(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000) + KST_OFFSET_SEC;
}

/** KST 로 민 epoch 초를 봉 시작 시각으로 내린다 */
export function bucketOf(kstSec: number, intervalSec: number): number {
  return Math.floor(kstSec / intervalSec) * intervalSec;
}

/** epoch 밀리초 → KST 날짜 'YYYY-MM-DD' */
export function kstDay(ms: number): string {
  return new Date(ms + KST_OFFSET_SEC * 1000).toISOString().slice(0, 10);
}

/**
 * 가격 틱 + 체결 → 분봉. 봉의 시가는 직전 봉 종가(가격이 이어지게), 거래량은 체결 수량 합.
 * 가격이 그대로인 체결(틱이 남지 않음)은 직전 종가로 평평한 봉을 만든다.
 */
export function buildIntradayBars(ticks: TickLike[], trades: TradeLike[], intervalSec = 300): Bar[] {
  type Ev = { t: number; order: number; id: number; price?: number; qty?: number; exec?: number };
  const events: Ev[] = [];
  for (const tk of ticks) {
    const t = kstSeconds(tk.created_at);
    if (!Number.isNaN(t)) events.push({ t, order: 0, id: tk.id, price: tk.price });
  }
  for (const tr of trades) {
    const t = kstSeconds(tr.created_at);
    if (!Number.isNaN(t)) events.push({ t, order: 1, id: tr.id, qty: tr.qty, exec: tr.exec_price });
  }
  // 같은 트랜잭션의 틱과 체결은 시각이 같다. 틱(가격)을 먼저 반영한다.
  events.sort((a, b) => a.t - b.t || a.order - b.order || a.id - b.id);

  const bars: Bar[] = [];
  let prevClose: number | null = null;
  for (const ev of events) {
    const time = bucketOf(ev.t, intervalSec);
    let last = bars[bars.length - 1];
    if (!last || (last.time as number) < time) {
      const open = prevClose ?? ev.price ?? ev.exec ?? 0;
      last = { time, open, high: open, low: open, close: open, volume: 0 };
      bars.push(last);
    }
    if (ev.price !== undefined) {
      last.high = Math.max(last.high, ev.price);
      last.low = Math.min(last.low, ev.price);
      last.close = ev.price;
      prevClose = ev.price;
    } else {
      last.volume += ev.qty ?? 0;
      if (prevClose === null) prevClose = last.close;
    }
  }
  return bars;
}

/** 실시간 주가를 마지막 분봉에 반영한다. 새 구간이면 봉을 하나 붙인다. */
export function applyLiveIntraday(bars: Bar[], price: number, kstSec: number, intervalSec = 300): Bar[] {
  const time = bucketOf(kstSec, intervalSec);
  const last = bars[bars.length - 1];
  if (!last) return [{ time, open: price, high: price, low: price, close: price, volume: 0 }];
  const lastTime = last.time as number;
  if (time > lastTime) {
    if (price === last.close) return bars;
    return [...bars, { time, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price, volume: 0 }];
  }
  if (last.close === price) return bars;
  return [...bars.slice(0, -1), { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price }];
}

/** 일봉 + 실시간 주가. today 봉이 없으면 기준가로 새 봉을 연다. */
export function buildDailyBars(candles: CandleLike[], live?: { day: string; price: number; dayOpen: number }): Bar[] {
  const bars: Bar[] = [...candles]
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    .map((c) => ({ time: c.day, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
  if (!live) return bars;
  const last = bars[bars.length - 1];
  if (last && last.time === live.day) {
    bars[bars.length - 1] = {
      ...last,
      high: Math.max(last.high, live.price),
      low: Math.min(last.low, live.price),
      close: live.price,
    };
  } else if (!last || (last.time as string) < live.day) {
    const o = live.dayOpen;
    bars.push({ time: live.day, open: o, high: Math.max(o, live.price), low: Math.min(o, live.price), close: live.price, volume: 0 });
  }
  return bars;
}

/** 'YYYY-MM-DD' 가 속한 주의 월요일 */
export function mondayOf(day: string): string {
  const ms = Date.parse(`${day}T00:00:00Z`);
  const dow = new Date(ms).getUTCDay(); // 0=일
  const back = (dow + 6) % 7;
  return new Date(ms - back * 86_400_000).toISOString().slice(0, 10);
}

/** 일봉 → 주봉 (월요일 기준) */
export function weeklyBars(daily: Bar[]): Bar[] {
  const out: Bar[] = [];
  for (const d of daily) {
    const wk = mondayOf(d.time as string);
    const last = out[out.length - 1];
    if (last && last.time === wk) {
      last.high = Math.max(last.high, d.high);
      last.low = Math.min(last.low, d.low);
      last.close = d.close;
      last.volume += d.volume;
    } else {
      out.push({ ...d, time: wk });
    }
  }
  return out;
}

/** 단순 이동평균 (종가). n 개가 안 모인 앞부분은 비운다. */
export function movingAverage(bars: Bar[], n: number): { time: number | string; value: number }[] {
  const out: { time: number | string; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= n) sum -= bars[i - n].close;
    if (i >= n - 1) out.push({ time: bars[i].time, value: Math.round((sum / n) * 100) / 100 });
  }
  return out;
}

// ───────────────────────────── 호가창 ─────────────────────────────

/** 한 호가 위 가격 */
export function tickUp(price: number): number {
  return price + tickSize(price);
}

/** 한 호가 아래 가격 (호가 단위가 바뀌는 경계에서는 아래 구간의 단위를 쓴다) */
export function tickDown(price: number): number {
  return price - tickSize(price - 1);
}

export type LadderRow = { price: number; sellQty: number; buyQty: number; sellOrders: number; buyOrders: number };

/**
 * 현재가 위아래 depth 칸의 호가 사다리. 지정가 주문이 있는 가격은 창 밖이어도 넣는다.
 * 높은 가격부터 정렬한다.
 */
export function buildLadder(
  levels: { side: "buy" | "sell"; price: number; qty: number; orders: number }[],
  price: number,
  bounds: { lo: number; hi: number },
  depth = 5,
): LadderRow[] {
  const rows = new Map<number, LadderRow>();
  const ensure = (p: number) => {
    let r = rows.get(p);
    if (!r) {
      r = { price: p, sellQty: 0, buyQty: 0, sellOrders: 0, buyOrders: 0 };
      rows.set(p, r);
    }
    return r;
  };
  ensure(price);
  let up = price;
  for (let i = 0; i < depth; i++) {
    const next = tickUp(up);
    if (next > bounds.hi) break;
    ensure(next);
    up = next;
  }
  let down = price;
  for (let i = 0; i < depth; i++) {
    const next = tickDown(down);
    if (next < bounds.lo || next <= 0) break;
    ensure(next);
    down = next;
  }
  for (const l of levels) {
    const r = ensure(l.price);
    if (l.side === "sell") {
      r.sellQty += l.qty;
      r.sellOrders += l.orders;
    } else {
      r.buyQty += l.qty;
      r.buyOrders += l.orders;
    }
  }
  return [...rows.values()].sort((a, b) => b.price - a.price);
}

// ───────────────────────────── 숫자 표시 ─────────────────────────────

/** 큰 금액을 만/억 단위로: 123,456,789 → 1.23억 · 45,600 → 4.56만 */
export function formatKoreanUnit(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, "");
  if (abs >= 1e12) return `${sign}${trim(abs / 1e12)}조`;
  if (abs >= 1e8) return `${sign}${trim(abs / 1e8)}억`;
  if (abs >= 1e4) return `${sign}${trim(abs / 1e4)}만`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}`;
}
