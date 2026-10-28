import { describe, expect, it } from "vitest";
import {
  applyLiveIntraday,
  buildDailyBars,
  buildIntradayBars,
  buildLadder,
  formatKoreanUnit,
  KST_OFFSET_SEC,
  mondayOf,
  movingAverage,
  tickDown,
  tickUp,
  weeklyBars,
} from "./chart-data";

const iso = (hh: number, mm: number, ss = 0) => new Date(Date.UTC(2026, 9, 28, hh, mm, ss)).toISOString();
const kst = (hh: number, mm: number) => Date.UTC(2026, 9, 28, hh, mm) / 1000 + KST_OFFSET_SEC;

describe("buildIntradayBars", () => {
  it("5분 구간으로 묶고 시가는 직전 종가를 잇는다", () => {
    const bars = buildIntradayBars(
      [
        { id: 1, price: 1000, created_at: iso(1, 0) },
        { id: 2, price: 1010, created_at: iso(1, 2) },
        { id: 3, price: 990, created_at: iso(1, 4) },
        { id: 4, price: 1005, created_at: iso(1, 7) },
      ],
      [{ id: 1, qty: 3, exec_price: 1005, created_at: iso(1, 2) }],
    );
    expect(bars).toEqual([
      { time: kst(1, 0), open: 1000, high: 1010, low: 990, close: 990, volume: 3 },
      { time: kst(1, 5), open: 990, high: 1005, low: 990, close: 1005, volume: 0 },
    ]);
  });

  it("가격이 그대로인 체결도 거래량 봉을 만든다", () => {
    const bars = buildIntradayBars(
      [{ id: 1, price: 1000, created_at: iso(1, 0) }],
      [{ id: 9, qty: 2, exec_price: 1000, created_at: iso(1, 12) }],
    );
    expect(bars[1]).toEqual({ time: kst(1, 10), open: 1000, high: 1000, low: 1000, close: 1000, volume: 2 });
  });
});

describe("applyLiveIntraday", () => {
  const base = [{ time: kst(1, 0), open: 1000, high: 1000, low: 1000, close: 1000, volume: 0 }];
  it("같은 구간이면 마지막 봉을 고친다", () => {
    expect(applyLiveIntraday(base, 1020, kst(1, 3))).toEqual([{ ...base[0], high: 1020, close: 1020 }]);
  });
  it("새 구간이면 봉을 붙인다", () => {
    const out = applyLiveIntraday(base, 990, kst(1, 6));
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ time: kst(1, 5), open: 1000, high: 1000, low: 990, close: 990, volume: 0 });
  });
  it("가격이 같으면 그대로", () => {
    expect(applyLiveIntraday(base, 1000, kst(1, 30))).toBe(base);
  });
});

describe("daily / weekly", () => {
  const candles = [
    { day: "2026-10-27", open: 100, high: 120, low: 90, close: 110, volume: 5 },
    { day: "2026-10-26", open: 95, high: 100, low: 94, close: 100, volume: 1 },
  ];
  it("정렬하고 오늘 봉에 실시간 가격을 반영한다", () => {
    const bars = buildDailyBars(candles, { day: "2026-10-27", price: 130, dayOpen: 100 });
    expect(bars.map((b) => b.time)).toEqual(["2026-10-26", "2026-10-27"]);
    expect(bars[1]).toMatchObject({ high: 130, close: 130 });
  });
  it("오늘 봉이 없으면 새로 연다", () => {
    const bars = buildDailyBars(candles, { day: "2026-10-28", price: 105, dayOpen: 110 });
    expect(bars[2]).toEqual({ time: "2026-10-28", open: 110, high: 110, low: 105, close: 105, volume: 0 });
  });
  it("월요일 기준 주봉", () => {
    expect(mondayOf("2026-10-28")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
    const w = weeklyBars(buildDailyBars(candles));
    expect(w).toEqual([{ time: "2026-10-26", open: 95, high: 120, low: 90, close: 110, volume: 6 }]);
  });
  it("이동평균", () => {
    const bars = [1, 2, 3, 4].map((c, i) => ({ time: i, open: c, high: c, low: c, close: c, volume: 0 }));
    expect(movingAverage(bars, 3)).toEqual([
      { time: 2, value: 2 },
      { time: 3, value: 3 },
    ]);
  });
});

describe("호가 사다리", () => {
  it("호가 단위 경계", () => {
    expect(tickUp(1999)).toBe(2000);
    expect(tickUp(2000)).toBe(2005);
    expect(tickDown(2000)).toBe(1999);
    expect(tickDown(2005)).toBe(2000);
  });
  it("현재가 위아래 칸과 주문을 합친다", () => {
    const rows = buildLadder(
      [
        { side: "sell", price: 1003, qty: 4, orders: 2 },
        { side: "buy", price: 900, qty: 1, orders: 1 },
      ],
      1000,
      { lo: 700, hi: 1300 },
      2,
    );
    expect(rows.map((r) => r.price)).toEqual([1003, 1002, 1001, 1000, 999, 998, 900]);
    expect(rows.find((r) => r.price === 1003)).toMatchObject({ sellQty: 4, sellOrders: 2 });
  });
  it("상한가에서 멈춘다", () => {
    const rows = buildLadder([], 1300, { lo: 700, hi: 1300 }, 3);
    expect(rows[0].price).toBe(1300);
  });
});

describe("formatKoreanUnit", () => {
  it("만 · 억 단위", () => {
    expect(formatKoreanUnit(123_456_789)).toBe("1.23억");
    expect(formatKoreanUnit(45_600)).toBe("4.56만");
    expect(formatKoreanUnit(9_999)).toBe("9,999");
  });
});
