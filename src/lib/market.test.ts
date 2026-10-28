import { describe, expect, it } from "vitest";
import {
  ceilDiv,
  changeRatio,
  direction,
  eventImpact,
  eventWeight,
  floorDiv,
  holdingValuation,
  limitBuyReserve,
  maxAffordableQty,
  previewTrade,
  priceBounds,
  roundTick,
  tickSize,
  roundDiv,
  toChartPoints,
  tradeErrorCode,
  tradeErrorMessage,
  type TradeConfig,
  appendSpark,
  sparklinePath,
} from "./market";

// market_config 기본값
const cfg: TradeConfig = {
  fee_rate: 0.005,
  sell_tax_rate: 0.01,
  min_price: 500,
  trade_impact: 0.002,
  max_trade_impact: 0.05,
  max_trade_qty: 100,
  price_limit_rate: 0.3,
  credit_margin_rate: 0.4,
  short_margin_rate: 0.5,
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

describe("호가 단위 · 가격 제한", () => {
  it("한국거래소 호가 단위", () => {
    expect(tickSize(1999)).toBe(1);
    expect(tickSize(2000)).toBe(5);
    expect(tickSize(19990)).toBe(10);
    expect(tickSize(600000)).toBe(1000);
  });
  it("roundTick 은 그 가격대의 호가 단위로 반올림한다", () => {
    expect(roundTick(1001.5)).toBe(1002);
    expect(roundTick(1999.5)).toBe(2000);
    expect(roundTick(2002.5)).toBe(2005);
  });
  it("상·하한가는 기준가 ±30% 를 호가 단위로 안쪽에 맞춘다", () => {
    expect(priceBounds(cfg, 1000)).toEqual({ lo: 700, hi: 1300 });
    expect(priceBounds(cfg, 1990)).toEqual({ lo: 1393, hi: 2585 });
  });
  it("하한가는 최저가 아래로 내려가지 않는다", () => {
    expect(priceBounds(cfg, 600).lo).toBe(500);
  });
});

describe("previewTrade — 현금 매수", () => {
  it("1주: 체결가는 충격의 절반, 수수료 0.5% 올림", () => {
    expect(previewTrade(cfg, 1000, 1000, "buy", 1)).toMatchObject({
      impact: 0.002,
      execPrice: 1001,
      newPrice: 1002,
      gross: 1001,
      fee: 6,
      tax: 0,
      cashDelta: -1007,
      error: null,
    });
  });

  it("10주", () => {
    expect(previewTrade(cfg, 1000, 1000, "buy", 10)).toMatchObject({
      execPrice: 1010, newPrice: 1020, gross: 10100, fee: 51, cashDelta: -10151,
    });
  });

  it("충격은 max_trade_impact 에서 멈춘다", () => {
    expect(previewTrade(cfg, 1000, 1000, "buy", 100)).toMatchObject({
      impact: 0.05, execPrice: 1025, newPrice: 1050, gross: 102500, fee: 513,
    });
  });

  it("상한가에서 멈추고 체결가도 그 안에서 정해진다", () => {
    expect(previewTrade(cfg, 1290, 1000, "buy", 10)).toMatchObject({ newPrice: 1300, execPrice: 1295 });
  });

  it("호가 단위가 바뀌는 2,000 경계", () => {
    expect(previewTrade(cfg, 1990, 1990, "buy", 10)).toMatchObject({ newPrice: 2030, execPrice: 2010, gross: 20100 });
  });

  it("잔고가 부족하면 insufficient_cash", () => {
    expect(previewTrade(cfg, 1000, 1000, "buy", 1, { cash: 1006 }).error).toBe("insufficient_cash");
    expect(previewTrade(cfg, 1000, 1000, "buy", 1, { cash: 1007 }).error).toBeNull();
  });
});

describe("previewTrade — 현금 매도", () => {
  it("수수료 0.5% + 거래세 1%", () => {
    expect(previewTrade(cfg, 1000, 1000, "sell", 10)).toMatchObject({
      execPrice: 990, newPrice: 980, gross: 9900, fee: 50, tax: 99, cashDelta: 9751, error: null,
    });
  });

  it("최저가(=하한가) 아래로 내려가지 않는다", () => {
    expect(previewTrade(cfg, 500, 500, "sell", 10)).toMatchObject({ execPrice: 500, newPrice: 500, gross: 5000 });
  });

  it("매도 가능 수량보다 많이 팔면 insufficient_shares", () => {
    expect(previewTrade(cfg, 1000, 1000, "sell", 6, { heldQty: 5 }).error).toBe("insufficient_shares");
    expect(previewTrade(cfg, 1000, 1000, "sell", 5, { heldQty: 5 }).error).toBeNull();
  });
});

describe("previewTrade — 신용 · 공매도", () => {
  it("신용매수: 보증금 40% + 수수료만 현금에서, 나머지는 대출", () => {
    expect(previewTrade(cfg, 1000, 1000, "buy", 10, { position: "credit" })).toMatchObject({
      gross: 10100, fee: 51, loan: 6060, cashDelta: -4091,
    });
  });

  it("신용 상환 매도: 매도대금에서 대출을 비율만큼 갚는다", () => {
    const p = previewTrade(cfg, 1000, 1000, "sell", 5, { position: "credit", positionQty: 10, positionLoan: 6060 });
    expect(p).toMatchObject({ gross: 4975, fee: 25, tax: 50, cashDelta: 1870, error: null });
  });

  it("공매도: 매도대금의 50% 를 보증금으로 묶는다", () => {
    expect(previewTrade(cfg, 1000, 1000, "sell", 10, { position: "short" })).toMatchObject({
      gross: 9900, margin: 4950, cashDelta: -4950,
    });
  });

  it("공매도 상환 매수: 담보를 비율만큼 풀고 되사는 돈을 낸다", () => {
    const p = previewTrade(cfg, 1000, 1000, "buy", 4, { position: "short", positionQty: 10, positionCollateral: 14601 });
    expect(p).toMatchObject({ gross: 4016, fee: 21, cashDelta: 1803, error: null });
  });

  it("보유한 포지션보다 많이 청산할 수 없다", () => {
    expect(previewTrade(cfg, 1000, 1000, "sell", 11, { position: "credit", positionQty: 10 }).error).toBe("insufficient_shares");
    expect(previewTrade(cfg, 1000, 1000, "buy", 11, { position: "short", positionQty: 10 }).error).toBe("insufficient_short");
  });
});

describe("previewTrade — 수량 검사", () => {
  it.each([0, -1, 1.5, 101, Number.NaN])("%s 주는 bad_qty", (qty) => {
    const p = previewTrade(cfg, 1000, 1000, "buy", qty);
    expect(p.error).toBe("bad_qty");
    expect(p.cashDelta).toBe(0);
  });
  it("max_trade_qty 는 허용", () => {
    expect(previewTrade(cfg, 1000, 1000, "buy", 100).error).toBeNull();
  });
});

describe("지정가 · 최대 수량", () => {
  it("지정가 매수는 지정가 × 수량 + 수수료를 묶는다", () => {
    expect(limitBuyReserve(cfg, 900, 5)).toBe(4523);
  });
  it("총액이 잔고 이하인 최대 수량", () => {
    expect(maxAffordableQty(cfg, 1000, 1000, 10151)).toBe(10);
    expect(maxAffordableQty(cfg, 1000, 1000, 10150)).toBe(9);
    expect(maxAffordableQty(cfg, 1000, 1000, 0)).toBe(0);
  });
  it("max_trade_qty 를 넘지 않는다", () => {
    expect(maxAffordableQty(cfg, 1000, 1000, 100_000_000)).toBe(100);
  });
  it("신용은 보증금 기준으로 더 많이 살 수 있다", () => {
    expect(maxAffordableQty(cfg, 1000, 1000, 4091, "credit")).toBe(10);
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
    expect(tradeErrorMessage({ message: "insufficient_shares" })).toContain("매도 가능 수량");
    expect(tradeErrorMessage({ message: "vi_halt" })).toContain("VI");
    expect(tradeErrorCode({ message: "insufficient_short" })).toBe("insufficient_short");
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

describe("스파크라인", () => {
  it("점이 2개 미만이면 그리지 않는다", () => {
    expect(sparklinePath([], 56, 24)).toBeNull();
    expect(sparklinePath([10], 56, 24)).toBeNull();
  });

  it("최저가는 아래, 최고가는 위에 놓인다", () => {
    expect(sparklinePath([10, 12], 50, 20, 2)).toBe("M0.0 18.0 L50.0 2.0");
  });

  it("값이 모두 같으면 가운데 수평선", () => {
    expect(sparklinePath([10, 10, 10], 40, 20)).toBe("M0.0 10.0 L20.0 10.0 L40.0 10.0");
  });

  it("직전 값과 같으면 붙이지 않고, 최대 길이를 넘으면 앞을 버린다", () => {
    expect(appendSpark([10, 11], 11)).toEqual([10, 11]);
    expect(appendSpark([10, 11], 12, 2)).toEqual([11, 12]);
  });
});
