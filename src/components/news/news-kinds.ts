import type { TagTone } from "@/components/ui/tag";
import type { MarketNews, Trade } from "@/lib/database.types";

export const NEWS_KIND_LABEL: Record<MarketNews["kind"], string> = {
  macro: "시장",
  sector: "업종",
  rumor: "루머",
  earnings: "실적",
  dividend: "배당",
  vi: "VI",
  limit_up: "상한가",
  limit_down: "하한가",
};

export function newsTone(kind: MarketNews["kind"]): TagTone {
  switch (kind) {
    case "rumor":
    case "vi":
      return "warn";
    case "limit_up":
      return "rise";
    case "limit_down":
      return "fall";
    case "earnings":
      return "sky";
    case "dividend":
      return "gold";
    case "sector":
      return "magic";
    default:
      return "neutral";
  }
}

/** 체결 종류 이름 — 현금 · 신용 · 공매도 × 매수 · 매도 */
export function tradeKindLabel(t: Pick<Trade, "side" | "position">): string {
  if (t.position === "credit") return t.side === "buy" ? "신용매수" : "신용상환";
  if (t.position === "short") return t.side === "sell" ? "공매도" : "공매도상환";
  return t.side === "buy" ? "매수" : "매도";
}
