import { describe, expect, it } from "vitest";
import {
  ceilDiv,
  changeRatio,
  direction,
  eventImpact,
  eventWeight,
  floorDiv,
  holdingValuation,
  maxAffordableQty,
  previewTrade,
  roundDiv,
  toChartPoints,
  tradeErrorCode,
  tradeErrorMessage,
  type TradeConfig,
} from "./market";

// market_config 기본값
const cfg: TradeConfig = {
  fee_rate: 0.01,
  min_price: 1,
  trade_impact: 0.002,
  max_trade_impact: 0.05,
  max_trade_qty: 1000,
};

describe("정수 나눗셈 헬퍼", () => {
  it("roundDiv 는 0.5 를 0에서 먼 쪽으로 반올림한다 (Postgres round)", () => {
    expect(roundDiv(BigInt(5), BigInt(2))).toBe(BigInt(3));
    expect(roundDiv(BigInt(-5), BigInt(2))).toBe(BigInt(-3));
    expect(roundDiv(BigInt(4), BigInt(3))).toBe(BigInt(1));
  });
  it("ceilDiv / floorDiv", () => {
    expect(ceilDiv(BigInt(7), BigInt(2))).toBe(BigInt(4));
    expect(ceilDiv(BigInt(6), BigInt(2))).toBe(BigInt(3));
    expect(ceilDiv(BigInt(-7), BigInt(2))).toBe(BigInt(-3));
    expect(floorDiv(BigInt(7), BigInt(2))).toBe(BigInt(3));
    expect(floorDiv(BigInt(-7), BigInt(2))).toBe(BigInt(-4));
  });
});

describe("previewTrade — 매수", () => {
  it("1주: 체결가는 충격의 절반만 반영, 최소 수수료 1", () => {
    expect(previewTrade(cfg, 10, "buy", 1)).toEqual({
      impact: 0.002,
      execPrice: 10.01,
      newPrice: 10.02,
      gross: 11,
      fee: 1,
      total: 12,
      error: null,
    });
  });

  it("10주: 수수료는 gross*1% 올림", () => {
    const p = previewTrade(cfg, 10, "buy", 10);
    expect(p).toMatchObject({ impact: 0.02, execPrice: 10.1, newPrice: 10.2, gross: 101, fee: 2, total: 103 });
  });

  it("충격은 max_trade_impact 에서 멈춘다", () => {
    const p = previewTrade(cfg, 10, "buy", 100);
    expect(p).toMatchObject({ impact: 0.05, execPrice: 10.25, newPrice: 10.5, gross: 1025, fee: 11, total: 1036 });
  });

  it("부동소수점 경계값도 SQL 과 같이 반올림한다 (2.50 × 1.002 = 2.505 → 2.51)", () => {
    const p = previewTrade(cfg, 2.5, "buy", 2);
    expect(p).toMatchObject({ execPrice: 2.51, newPrice: 2.51, gross: 6, fee: 1, total: 7 });
  });

  it("잔고가 부족하면 insufficient_cash", () => {
    expect(previewTrade(cfg, 10, "buy", 1, { cash: 11 }).error).toBe("insufficient_cash");
    expect(previewTrade(cfg, 10, "buy", 1, { cash: 12 }).error).toBeNull();
  });
});

describe("previewTrade — 매도", () => {
  it("10주: 체결가 내림, 수수료 차감", () => {
    const p = previewTrade(cfg, 10, "sell", 10);
    expect(p).toMatchObject({ execPrice: 9.9, newPrice: 9.8, gross: 99, fee: 1, total: 98, error: null });
  });

  it("새 주가는 min_price 아래로 내려가지 않는다", () => {
    const p = previewTrade(cfg, 1, "sell", 25);
    // exec = round(0.975, 2) = 0.98, gross = floor(24.5) = 24
    expect(p).toMatchObject({ execPrice: 0.98, newPrice: 1, gross: 24, fee: 1, total: 23 });
  });

  it("수수료는 gross 를 넘지 않는다", () => {
    const p = previewTrade(cfg, 1, "sell", 1);
    expect(p).toMatchObject({ gross: 1, fee: 1, total: 0 });
  });

  it("보유 수량보다 많이 팔면 insufficient_shares", () => {
    expect(previewTrade(cfg, 10, "sell", 6, { heldQty: 5 }).error).toBe("insufficient_shares");
    expect(previewTrade(cfg, 10, "sell", 5, { heldQty: 5 }).error).toBeNull();
  });
});

describe("previewTrade — 수량 검사", () => {
  it.each([0, -1, 1.5, 1001, Number.NaN])("%s 주는 bad_qty", (qty) => {
    const p = previewTrade(cfg, 10, "buy", qty);
    expect(p.error).toBe("bad_qty");
    expect(p.total).toBe(0);
  });
  it("max_trade_qty 는 허용", () => {
    expect(previewTrade(cfg, 10, "buy", 1000).error).toBeNull();
  });
});

describe("maxAffordableQty", () => {
  it("총액이 잔고 이하인 최대 수량", () => {
    expect(maxAffordableQty(cfg, 10, 103)).toBe(10);
    expect(maxAffordableQty(cfg, 10, 102)).toBe(9);
    expect(maxAffordableQty(cfg, 10, 0)).toBe(0);
  });
  it("max_trade_qty 를 넘지 않는다", () => {
    expect(maxAffordableQty(cfg, 1, 1_000_000)).toBe(1000);
  });
});

describe("에러 매핑", () => {
  it("PostgrestError message 에서 코드를 찾는다", () => {
    expect(tradeErrorCode({ message: "insufficient_cash", code: "P0001" })).toBe("insufficient_cash");
    expect(tradeErrorCode({ message: "insufficient_shares" })).toBe("insufficient_shares");
    expect(tradeErrorCode("self_trade")).toBe("self_trade");
    expect(tradeErrorCode({ message: "no_stock" })).toBe("no_stock");
    expect(tradeErrorCode({ message: "something else" })).toBeNull();
    expect(tradeErrorCode(null)).toBeNull();
  });

  it("한국어 메시지로 바꾼다", () => {
    expect(tradeErrorMessage({ message: "insufficient_cash" })).toContain("/증권 입금");
    expect(tradeErrorMessage({ message: "insufficient_shares" })).toBe("보유한 주식보다 많이 팔 수는 없어요.");
    expect(tradeErrorMessage({ message: "self_trade" })).toBe("자기 자신의 주식은 사고팔 수 없어요.");
    expect(tradeErrorMessage({ message: "no_stock" })).toBe("상장되지 않은 학생이에요.");
    expect(tradeErrorMessage({ message: "bad_qty" })).toBe("수량이 올바르지 않아요.");
  });

  it("bad_qty 는 설정의 최대 수량을 알려준다", () => {
    expect(tradeErrorMessage({ message: "bad_qty" }, { max_trade_qty: 1000 })).toBe(
      "수량은 1주부터 1,000주까지 가능해요.",
    );
  });

  it("네트워크/알 수 없는 에러", () => {
    expect(tradeErrorMessage(new TypeError("Failed to fetch"))).toContain("연결");
    expect(tradeErrorMessage({ message: "boom" })).toBe("거래에 실패했어요. 잠시 후 다시 시도해 주세요.");
  });
});

describe("이벤트 가중치", () => {
  it("payload.weight 를 0~3 으로 자르고 기본 1", () => {
    expect(eventWeight({})).toBe(1);
    expect(eventWeight(null)).toBe(1);
    expect(eventWeight({ weight: 2 })).toBe(2);
    expect(eventWeight({ weight: "1.5" })).toBe(1.5);
    expect(eventWeight({ weight: 10 })).toBe(3);
    expect(eventWeight({ weight: -1 })).toBe(0);
    expect(eventWeight({ weight: "abc" })).toBe(1);
  });
  it("eventImpact = pct * weight, 모르는 이벤트는 0", () => {
    expect(eventImpact(0.02, { weight: 2 })).toBeCloseTo(0.04);
    expect(eventImpact(undefined, {})).toBe(0);
  });
});

describe("등락 · 평가", () => {
  it("changeRatio / direction", () => {
    expect(changeRatio(11, 10)).toBeCloseTo(0.1);
    expect(changeRatio(5, 0)).toBe(0);
    expect(direction(0.1)).toBe("up");
    expect(direction(-0.1)).toBe("down");
    expect(direction(0)).toBe("flat");
  });
  it("holdingValuation 은 floor(qty*price) 로 평가", () => {
    expect(holdingValuation(3, 30, 10.33)).toEqual({ value: 30, pnl: 0, pnlRatio: 0 });
    const v = holdingValuation(10, 100, 12.5);
    expect(v.value).toBe(125);
    expect(v.pnl).toBe(25);
    expect(v.pnlRatio).toBeCloseTo(0.25);
    expect(holdingValuation(1, 0, 5).pnlRatio).toBe(0);
  });
});

describe("toChartPoints", () => {
  it("id 순으로 정렬하고 KST 로 밀고 같은 초는 마지막 값만", () => {
    const pts = toChartPoints([
      { id: 3, price: 12, created_at: "2026-10-28T00:00:10Z" },
      { id: 1, price: 10, created_at: "2026-10-28T00:00:00Z" },
      { id: 2, price: 11, created_at: "2026-10-28T00:00:00.500Z" },
    ]);
    const base = Date.parse("2026-10-28T00:00:00Z") / 1000 + 9 * 3600;
    expect(pts).toEqual([
      { time: base, value: 11 },
      { time: base + 10, value: 12 },
    ]);
  });
  it("offset 을 지정할 수 있다", () => {
    expect(toChartPoints([{ id: 1, price: 1, created_at: "1970-01-01T00:00:05Z" }], 0)).toEqual([
      { time: 5, value: 1 },
    ]);
  });
});
