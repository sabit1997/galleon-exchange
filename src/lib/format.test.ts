import { describe, expect, it } from "vitest";
import {
  formatGalleon,
  formatPct,
  formatPrice,
  formatRelativeTime,
  formatSignedGalleon,
  houseKey,
} from "./format";

describe("숫자 포맷", () => {
  it("formatPrice 는 소수 둘째 자리", () => {
    expect(formatPrice(1234.5)).toBe("1,234.50");
    expect(formatPrice(10)).toBe("10.00");
  });
  it("formatGalleon / formatSignedGalleon", () => {
    expect(formatGalleon(1234567)).toBe("1,234,567");
    expect(formatSignedGalleon(1200)).toBe("+1,200");
    expect(formatSignedGalleon(-56)).toBe("-56");
    expect(formatSignedGalleon(0)).toBe("0");
  });
  it("formatPct 는 부호를 붙이고 -0 을 만들지 않는다", () => {
    expect(formatPct(0.0123)).toBe("+1.23%");
    expect(formatPct(-0.005)).toBe("-0.50%");
    expect(formatPct(0)).toBe("0.00%");
    expect(formatPct(-0.00001)).toBe("0.00%");
    expect(formatPct(0.1, 1)).toBe("+10.0%");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  it("구간별 표현", () => {
    expect(formatRelativeTime("2026-10-28T11:59:30Z", now)).toBe("방금");
    expect(formatRelativeTime("2026-10-28T11:57:00Z", now)).toBe("3분 전");
    expect(formatRelativeTime("2026-10-28T10:00:00Z", now)).toBe("2시간 전");
    expect(formatRelativeTime("2026-10-25T12:00:00Z", now)).toBe("3일 전");
  });
  it("7일 넘으면 KST 날짜", () => {
    // 10/1 16:00 UTC = 10/2 01:00 KST
    expect(formatRelativeTime("2026-10-01T16:00:00Z", now)).toBe("10월 2일");
  });
  it("미래·잘못된 값", () => {
    expect(formatRelativeTime("2026-10-28T12:00:30Z", now)).toBe("방금");
    expect(formatRelativeTime("not a date", now)).toBe("");
  });
});

describe("houseKey", () => {
  it("한글/영문/이모지 섞인 이름을 인식한다", () => {
    expect(houseKey("그리핀도르")).toBe("gryffindor");
    expect(houseKey("🐍 슬리데린")).toBe("slytherin");
    expect(houseKey("Ravenclaw")).toBe("ravenclaw");
    expect(houseKey("후플푸프")).toBe("hufflepuff");
    expect(houseKey("머글")).toBe("none");
    expect(houseKey(null)).toBe("none");
  });
});
