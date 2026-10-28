"use client";

import { useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Galleon } from "@/components/ui/galleon";
import type { MarketConfig, Stock, TradeResult } from "@/lib/database.types";
import { formatGalleon, formatPct, formatPrice } from "@/lib/format";
import { maxAffordableQty, previewTrade, tradeErrorMessage, type TradeSide } from "@/lib/market";

type Feedback = { kind: "ok" | "error"; text: string } | null;

export function TradeForm({ stock, config }: { stock: Stock; config: MarketConfig }) {
  const { supabase, guildId, me } = useMemberSession();
  const { cash, holdings, refresh } = useAccount();
  const [side, setSide] = useState<TradeSide>("buy");
  const [qtyText, setQtyText] = useState("1");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const isSelf = stock.discord_id === me;
  const heldQty = holdings.get(stock.discord_id)?.qty ?? 0;
  const qty = qtyText === "" ? 0 : Number(qtyText);
  const preview = previewTrade(config, stock.price, side, qty, { cash, heldQty });
  const maxQty = side === "buy" ? maxAffordableQty(config, stock.price, cash) : Math.min(heldQty, config.max_trade_qty);

  if (isSelf) {
    return (
      <div className="rounded-2xl bg-white/[0.04] p-4 text-sm leading-relaxed text-slate-300 ring-1 ring-inset ring-white/6">
        🪞 내 주식은 직접 사고팔 수 없어요. 열심히 공부해서 주가를 올려 보세요!
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview.error || pending) return;
    setPending(true);
    setFeedback(null);
    const { data, error } = await supabase.rpc("trade", {
      p_guild: guildId,
      p_stock: stock.discord_id,
      p_side: side,
      p_qty: qty,
    });
    setPending(false);
    if (error) {
      setFeedback({ kind: "error", text: tradeErrorMessage(error, config) });
      return;
    }
    const r = data as unknown as TradeResult;
    const verb = side === "buy" ? "매수" : "매도";
    setFeedback({
      kind: "ok",
      text: `${stock.display_name} ${qty.toLocaleString("ko-KR")}주 ${verb} 체결! 체결가 ${formatPrice(r.exec_price)} · 수수료 ${formatGalleon(r.fee)} 갈레온`,
    });
    void refresh();
  };

  const tabClass = (s: TradeSide) =>
    `pressable flex-1 rounded-xl py-2 text-sm font-semibold ${
      side === s
        ? s === "buy"
          ? "bg-rise-deep text-white shadow-[0_6px_16px_-6px_rgb(229_51_75/0.8)]"
          : "bg-fall-deep text-white shadow-[0_6px_16px_-6px_rgb(47_111_236/0.8)]"
        : "text-slate-400 hover:text-slate-200"
    }`;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-1 rounded-2xl border border-white/6 bg-white/[0.03] p-1" role="tablist" aria-label="주문 종류">
        <button type="button" role="tab" aria-selected={side === "buy"} className={tabClass("buy")} onClick={() => setSide("buy")}>
          매수
        </button>
        <button type="button" role="tab" aria-selected={side === "sell"} className={tabClass("sell")} onClick={() => setSide("sell")}>
          매도
        </button>
      </div>

      <div className="flex justify-between text-sm text-slate-400">
        <span>
          주문 가능 <Galleon value={cash} className="font-medium text-slate-100" />
        </span>
        <span>보유 {heldQty.toLocaleString("ko-KR")}주</span>
      </div>

      <div>
        <label htmlFor="qty" className="mb-1.5 block text-sm text-slate-400">
          수량 (최대 {config.max_trade_qty.toLocaleString("ko-KR")}주)
        </label>
        <div className="flex gap-2">
          <input
            id="qty"
            inputMode="numeric"
            autoComplete="off"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            className="field min-w-0 flex-1 px-3.5 py-2.5 text-right text-lg font-semibold tabular-nums text-slate-50"
          />
          {[1, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQtyText(String(Math.min(config.max_trade_qty, qty + n)))}
              className="pressable shrink-0 rounded-xl bg-white/[0.05] px-3 text-sm font-medium text-slate-300 hover:bg-white/10"
            >
              +{n}
            </button>
          ))}
          <button
            type="button"
            disabled={maxQty < 1}
            onClick={() => setQtyText(String(maxQty))}
            className="pressable shrink-0 rounded-xl bg-white/[0.05] px-3 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-40"
          >
            최대
          </button>
        </div>
      </div>

      <dl className="space-y-2 rounded-2xl bg-white/[0.035] p-4 text-sm ring-1 ring-inset ring-white/5">
        <Row label="예상 체결가">
          <Galleon value={preview.execPrice} price />
        </Row>
        <Row label="체결 금액">
          <Galleon value={preview.gross} />
        </Row>
        <Row label={`수수료 (${formatPct(config.fee_rate, 0).replace("+", "")})`}>
          <Galleon value={preview.fee} />
        </Row>
        <div className="!my-3 border-t border-white/8" />
        <Row label={side === "buy" ? "총 결제 금액" : "받을 금액"} strong>
          <Galleon value={preview.total} />
        </Row>
        <Row label="체결 후 주가">
          <span className="text-slate-300">
            <Galleon value={preview.newPrice} price /> ({formatPct(preview.newPrice / stock.price - 1)})
          </span>
        </Row>
      </dl>
      <p className="text-xs leading-relaxed text-slate-500">
        큰 주문일수록 주가를 더 움직여요 (주당 {formatPct(config.trade_impact, 1).replace("+", "")}, 최대{" "}
        {formatPct(config.max_trade_impact, 0).replace("+", "")}). 다른 주문이 먼저 체결되면 금액이 조금 달라질 수 있어요.
      </p>

      {preview.error && qty > 0 && (
        <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{tradeErrorMessage(preview.error, config)}</p>
      )}

      <button
        type="submit"
        disabled={pending || preview.error !== null}
        className={`pressable h-13 w-full rounded-2xl text-[15px] font-bold text-white disabled:opacity-40 ${
          side === "buy"
            ? "bg-rise-deep shadow-[0_10px_24px_-10px_rgb(229_51_75/0.9)] hover:brightness-110"
            : "bg-fall-deep shadow-[0_10px_24px_-10px_rgb(47_111_236/0.9)] hover:brightness-110"
        }`}
      >
        {pending ? "체결 중…" : side === "buy" ? "매수하기" : "매도하기"}
      </button>

      {feedback && (
        <p role="status" className={`animate-fade-up rounded-xl px-3 py-2.5 text-sm ${feedback.kind === "ok" ? "bg-emerald-400/10 text-emerald-200" : "bg-red-400/10 text-red-200"}`}>
          {feedback.text}
        </p>
      )}
    </form>
  );
}

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "font-semibold text-slate-100" : "text-slate-400"}`}>
      <dt>{label}</dt>
      <dd className={strong ? "text-base font-bold text-slate-50" : "text-slate-200"}>{children}</dd>
    </div>
  );
}
