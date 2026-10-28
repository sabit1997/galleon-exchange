"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** 주식 공부용 용어 풀이. 화면 곳곳의 "?" 에서 쓴다. */
export const GLOSSARY = {
  현재가:
    "지금 이 순간 마지막으로 정해진 주가예요. 체결이 일어나거나 뉴스·실적이 나오면 바뀌어요.",
  기준가:
    "오늘 등락률과 상한가·하한가를 계산하는 기준 가격이에요. 매일 자정(00:00)에 새로 정해지고, 그때 시가와 같아요.",
  시가: "오늘 장이 시작될 때(자정)의 첫 가격이에요.",
  고가: "오늘 하루 중 가장 높았던 가격이에요.",
  저가: "오늘 하루 중 가장 낮았던 가격이에요.",
  상한가:
    "하루에 오를 수 있는 최고 가격이에요. 기준가의 +30%를 호가 단위로 내린 값이에요.",
  하한가:
    "하루에 내릴 수 있는 최저 가격이에요. 기준가의 −30%를 호가 단위로 올린 값이에요.",
  거래량: "오늘 사고팔린 주식 수의 합계예요.",
  거래대금:
    "오늘 사고팔린 금액의 합계(체결가 × 수량)예요. 거래가 활발할수록 커요.",
  시가총액: "회사 전체의 몸값이에요. 현재가 × 발행주식수로 계산해요.",
  발행주식수: "이 종목이 발행한 전체 주식 수예요. 모든 학생 종목이 같아요.",
  "52주":
    "이 종목이 상장된 뒤 전체 기간의 최고·최저 가격이에요 (실제 증권앱의 52주 최고/최저와 같은 자리).",
  공부PER:
    "주가수익비율(PER)을 공부시간으로 바꾼 지표예요. 현재가 ÷ 지난주 실제 공부시간(분). 낮을수록 공부량에 비해 주가가 싸다는 뜻이에요.",
  호가: "사고 싶은·팔고 싶은 가격이에요. 가격대별로 걸려 있는 지정가 주문의 수량(잔량)을 보여줘요.",
  호가단위:
    "주문할 수 있는 가격 간격이에요. 2,000 미만 1, 5,000 미만 5, 20,000 미만 10 … 처럼 가격대마다 달라요.",
  매도잔량:
    "그 가격에 팔겠다고 걸어 둔 주식 수예요. 위쪽(파란색)이 매도 호가예요.",
  매수잔량:
    "그 가격에 사겠다고 걸어 둔 주식 수예요. 아래쪽(빨간색)이 매수 호가예요.",
  마켓메이커:
    "시장가 주문은 마켓메이커가 바로 받아 줘서 항상 체결돼요. 대신 주문 수량이 많을수록 주당 0.2%씩(최대 5%) 가격이 불리해져요.",
  시장가:
    "가격을 정하지 않고 지금 바로 체결하는 주문이에요. 빠르지만 수량이 많으면 체결가가 불리해질 수 있어요.",
  지정가:
    "원하는 가격을 정해 두는 주문이에요. 시장 가격이 그 가격에 닿으면 자동으로 전량 체결돼요. 오늘 자정까지만 유효해요.",
  주문가능금액:
    "지금 바로 주문에 쓸 수 있는 현금이에요. 지정가 매수에 묶인 돈은 빠져 있어요.",
  미체결:
    "아직 체결되지 않고 기다리는 지정가 주문이에요. 취소하면 묶여 있던 돈·주식이 돌아와요.",
  수수료:
    "증권사에 내는 거래 비용이에요. 사고팔 때마다 체결금액의 0.5%(최소 1갈레온).",
  거래세: "주식을 팔 때만 내는 세금이에요. 매도 체결금액의 1%.",
  신용: "증권사에서 돈을 빌려 사는 거예요. 체결금액의 40%만 내 돈(보증금)으로 내고 나머지 60%는 대출이에요. 대출에는 하루 0.1% 이자가 붙어요.",
  신용상환:
    "신용으로 산 주식을 팔아 대출을 갚는 거예요. 판 돈에서 대출금을 먼저 갚고 남은 돈이 들어와요.",
  공매도:
    "주식을 빌려서 먼저 팔고, 나중에 싸게 되사서 갚는 거예요. 주가가 내릴 때 돈을 벌어요. 체결금액의 50%를 보증금으로 맡기고 하루 0.05% 대차료를 내요.",
  공매도상환:
    "공매도한 주식을 시장에서 되사서 갚는 거예요. 판 가격보다 싸게 사면 이익이에요.",
  담보비율:
    "포지션을 지키는 안전장치예요. 신용은 평가금액 ÷ 대출금이 140% 아래로, 공매도는 담보 ÷ 평가금액이 120% 아래로 내려가면 강제로 정리(반대매매)돼요.",
  반대매매:
    "담보비율이 기준 아래로 떨어지면 증권사가 강제로 팔거나(신용) 되사서(공매도) 포지션을 정리하는 거예요.",
  VI: "변동성 완화장치. 주가가 기준가(또는 직전 VI 가격)에서 10% 넘게 움직이면 2분간 시장가 거래를 멈춰 열기를 식혀요. 지정가 주문은 걸어 둘 수 있어요.",
  평가손익:
    "지금 팔면 얼마를 벌거나 잃는지예요. 평가금액 − 매입금액(수수료 포함).",
  수익률: "평가손익 ÷ 매입금액이에요.",
  평균단가: "산 주식의 1주당 평균 가격(수수료 포함)이에요.",
  컨센서스:
    "이번 주에 이만큼 공부할 거라는 시장의 예상치예요. 최근 4주 실제 공부시간의 평균이에요.",
  실적: "매주 월요일 지난주 실제 공부시간을 발표해요. 예상보다 많으면 어닝 서프라이즈(주가↑), 적으면 어닝 쇼크(주가↓).",
  배당: "지난주 걷힌 수수료·세금의 일부를 공부한 만큼 주주에게 나눠 줘요. 배당이 나간 뒤엔 그만큼 주가가 내려가요(배당락).",
  체결: "실제로 거래가 이뤄진 기록이에요. 빨간색은 매수 체결, 파란색은 매도 체결이에요.",
  체결예상가:
    "마켓메이커와 거래할 때의 가격이에요. 주문 전 가격과 주문 후 가격의 중간값이에요.",
  등락률:
    "기준가 대비 지금 가격이 몇 % 오르거나 내렸는지예요. 빨간색 ▲ 상승, 파란색 ▼ 하락.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

const POP_WIDTH = 248;

/** 작은 "?" 버튼. 누르거나(모바일) 마우스를 올리면(데스크톱) 풀이가 뜬다. */
export function HelpTip({
  term,
  text,
  className = "",
}: {
  term?: GlossaryKey;
  text?: string;
  className?: string;
}) {
  const body = text ?? (term ? GLOSSARY[term] : "");
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const hovering = useRef(false);
  const id = useId();

  // 위치는 버튼 바로 아래(공간이 없으면 바로 위)에 잡고, 실제 크기를 잰 뒤 화면 안으로 붙잡는다.
  // 패널의 backdrop-blur 등이 fixed 의 기준을 바꾸지 않도록 body 로 포털 렌더링한다.
  const place = () => {
    const el = btnRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pop = popRef.current;
    const w = Math.min(POP_WIDTH, window.innerWidth - 16);
    const h = pop?.offsetHeight ?? 0;
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - w / 2),
      window.innerWidth - w - 8,
    );
    const below = r.bottom + 6;
    const top =
      below + h > window.innerHeight - 8 && r.top - 6 - h >= 8
        ? r.top - 6 - h
        : below;
    return { left, top };
  };
  const show = () => setPos(place());

  // 첫 렌더에선 높이를 몰라 아래로 놓으므로, 그린 직후 실제 크기로 다시 맞춘다 (DOM 에 직접 반영)
  useLayoutEffect(() => {
    const pop = popRef.current;
    const next = pos && place();
    if (!pop || !next) return;
    pop.style.left = `${next.left}px`;
    pop.style.top = `${next.top}px`;
  });

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`${term ?? "도움말"} 설명`}
        aria-describedby={pos ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (pos && !hovering.current) setPos(null);
          else show();
        }}
        // 터치에서는 탭(click)으로만 연다 — pointerenter 와 click 이 연달아 와서 바로 닫히지 않게
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          hovering.current = true;
          show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          hovering.current = false;
          setPos(null);
        }}
        onBlur={() => setPos(null)}
        className={`inline-grid h-3.5 w-3.5 shrink-0 cursor-help place-items-center rounded-full bg-white/8 align-middle text-[9px] font-bold leading-none text-slate-400 hover:bg-white/15 hover:text-slate-100 ${className}`}
      >
        ?
      </button>
      {pos &&
        createPortal(
          <span
            ref={popRef}
            id={id}
            role="tooltip"
            style={{
              left: pos.left,
              top: pos.top,
              width: Math.min(POP_WIDTH, window.innerWidth - 16),
            }}
            className="pointer-events-none fixed z-50 rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 text-left text-xs font-normal leading-relaxed text-slate-200 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.8)] backdrop-blur"
          >
            {term && (
              <b className="mb-0.5 block text-[11px] text-magic-bright">
                {term === "공부PER" ? "공부 PER" : term}
              </b>
            )}
            {body}
          </span>,
          document.body,
        )}
    </>
  );
}

/** 용어 + "?" 를 한 덩어리로 */
export function Term({
  k,
  children,
  className = "",
}: {
  k: GlossaryKey;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {children ?? k}
      <HelpTip term={k} />
    </span>
  );
}
