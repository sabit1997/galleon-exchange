"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/ui/card";
import { SearchIcon } from "@/components/ui/icons";
import { ChipGroup } from "@/components/ui/tabs";
import { CATEGORIES, GLOSSARY, QUICK_FACTS, type GlossaryTerm, type TermCategory } from "./glossary";

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "입금하기",
    body: (
      <>
        디스코드에서 <Cmd>/증권 입금</Cmd> 으로 봇 지갑의 갈레온을 증권계좌로 옮겨요. 사이트에서는 입출금을 할 수 없어요. 입금하면 계좌가 자동으로 만들어지고, 헤더의{" "}
        <b className="text-gold-bright">주문가능</b> 금액이 늘어나요.
      </>
    ),
  },
  {
    title: "종목 고르기",
    body: (
      <>
        <Link href="/" className="font-semibold text-magic-bright underline underline-offset-4">
          시장
        </Link>{" "}
        화면에서 종합지수·업종지수로 전체 분위기를 보고, 시세표를 등락률·거래량으로 정렬해 보세요.{" "}
        <Link href="/news" className="font-semibold text-magic-bright underline underline-offset-4">
          예언자 일보
        </Link>
        의 실적·뉴스도 확인해요. 친구가 꾸준히 공부한다면(실적) 좋은 종목일 수 있어요. 내 종목은 살 수 없어요.
      </>
    ),
  },
  {
    title: "주문하기",
    body: (
      <>
        종목을 눌러 주문해요. 바로 사려면 <TermA id="market-order">시장가</TermA>, 원하는 가격을 기다리려면 <TermA id="limit-order">지정가</TermA>. 처음엔{" "}
        <b>현금</b> 매수만 해 보세요. <TermA id="credit">신용</TermA>·<TermA id="short">공매도</TermA>는 손실이 커질 수 있어요. 한 번에 최대 100주, 주문 전 미리보기의 체결가·수수료를 꼭
        확인해요.
      </>
    ),
  },
  {
    title: "확인하기",
    body: (
      <>
        <Link href="/portfolio" className="font-semibold text-magic-bright underline underline-offset-4">
          내 계좌
        </Link>
        에서 보유 주식의 평가손익, 기다리는 <TermA id="unfilled">미체결</TermA> 주문, 체결내역, 배당내역을 볼 수 있어요. 지정가 주문은 00:00에 만료돼요.
      </>
    ),
  },
  {
    title: "출금하기",
    body: (
      <>
        주식을 팔아 생긴 갈레온은 디스코드 <Cmd>/증권 출금</Cmd> 으로 봇 지갑에 돌려받아요. 주문가능금액 안에서만 출금되고, 신용 대출금과 공매도 담보는 출금할 수 없어요.
      </>
    ),
  },
];

const TIPS: { tone: "tip" | "warn"; title: string; body: string; term: string }[] = [
  {
    tone: "warn",
    title: "왕복 비용이 약 2%예요",
    body: "매수 수수료 0.5% + 매도 수수료 0.5% + 거래세 1%. 1,000에 사서 1,020에 팔아도 거의 본전이에요. 자주 사고팔수록 비용만 쌓여요.",
    term: "fee",
  },
  {
    tone: "warn",
    title: "많이 살수록 비싸게 사요",
    body: "주문 1주당 가격이 0.2%씩(최대 5%) 밀려요. 25주 이상 한 번에 사면 체결가가 현재가보다 약 2.5% 비싸져요. 나눠 사도 앞 주문이 이미 가격을 올려 놓아요.",
    term: "market-order",
  },
  {
    tone: "warn",
    title: "레버리지는 양날의 검",
    body: "신용매수는 약 2.5배로 움직여서 주가가 16%만 떨어져도 반대매매될 수 있어요. 이자는 하루 0.1%, 한 달이면 약 3%예요. 공매도는 주가가 오를수록 손실이 커지고, 약 24% 오르면 담보가 모자라 강제로 되사요.",
    term: "credit",
  },
  {
    tone: "warn",
    title: "루머는 동전 던지기",
    body: "이 시장의 루머는 호재·악재가 반반 무작위예요. 루머 보고 따라 사면 비용만 낼 가능성이 커요. 실제 시장에서도 ‘카더라’는 조심!",
    term: "news",
  },
  {
    tone: "tip",
    title: "평균으로 돌아가는 힘",
    body: "매일 00:00 주가가 상장가 1,000 쪽으로 차이의 5%씩 돌아가요. 아주 비싸진 주식은 시간이 지나며 조금씩 내려오고, 아주 싸진 주식은 조금씩 올라와요.",
    term: "base-price",
  },
  {
    tone: "tip",
    title: "공부하는 친구가 실적 좋은 회사",
    body: "매주 월요일 공부시간이 예상보다 많으면 주가가 최대 15% 오르고, 배당도 공부시간만큼 더 받아요. 꾸준히 공부하는 친구를 찾아보세요.",
    term: "earnings",
  },
  {
    tone: "tip",
    title: "나눠 담기",
    body: "업종 뉴스는 한 기숙사를 통째로 움직여요. 여러 기숙사에 나눠 담으면 한 번의 악재로 크게 잃지 않아요.",
    term: "diversify",
  },
  {
    tone: "tip",
    title: "규칙을 먼저 정하기",
    body: "‘얼마 오르면 팔고, 얼마 떨어지면 판다’를 사기 전에 정해 두세요. 익절은 지정가 매도로 걸어 둘 수 있어요(그날 00:00까지).",
    term: "stop",
  },
];

function Cmd({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-gold/10 px-1.5 py-0.5 text-[0.95em] font-semibold text-gold-bright">{children}</code>;
}

/** 같은 페이지 안 용어로 이동 (해시 변경 → 필터를 풀고 스크롤) */
function TermA({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a href={`#t-${id}`} className="font-semibold text-slate-100 underline decoration-dotted decoration-slate-500 underline-offset-4 hover:text-magic-bright">
      {children}
    </a>
  );
}

type CatFilter = "all" | TermCategory;

export function LearnGuide() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CatFilter>("all");

  // 다른 화면의 /learn#t-xxx 링크로 들어오면 그 용어로 스크롤한다 (게이트를 지나 늦게 그려지므로 직접 처리).
  useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      setQuery("");
      setCat("all");
      // 필터가 풀린 뒤 그려진 요소로 이동
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    const first = setTimeout(go, 0);
    window.addEventListener("hashchange", go);
    return () => {
      clearTimeout(first);
      window.removeEventListener("hashchange", go);
    };
  }, []);

  const terms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY.filter(
      (t) =>
        (cat === "all" || t.category === cat) &&
        (!q || [t.term, t.aka ?? "", t.plain, t.here, t.real].some((s) => s.toLowerCase().includes(q))),
    );
  }, [query, cat]);

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="초보 마법사를 위한"
        title="주식 공부"
        subtitle="갈레온 증권은 실제 한국 주식시장의 규칙(호가 단위 · 상하한가 · VI · 수수료와 세금 · 신용 · 공매도 · 실적 · 배당)을 그대로 본떠 만들었어요. 여기서 연습하고 진짜 시장도 이해해 봐요."
      />

      <nav aria-label="목차" className="scroll-x -mt-2">
        <ul className="flex min-w-max gap-1.5 text-[12.5px]">
          {[
            ["#start", "처음 시작하기"],
            ["#facts", "숫자 한눈에"],
            ["#glossary", "용어 사전"],
            ["#tips", "꿀팁 · 주의"],
          ].map(([href, label]) => (
            <li key={href}>
              <a href={href} className="chip pressable">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 처음 시작하기 */}
      <section id="start" className="scroll-mt-24" aria-labelledby="start-title">
        <h2 id="start-title" className="mb-3 text-[17px] font-bold text-slate-50">
          처음 시작하기 · 5단계
        </h2>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="sheet rounded-2xl p-4">
              <p className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-magic/20 text-[12px] font-bold text-magic-bright tabular-nums">{i + 1}</span>
                <span className="text-[15px] font-bold text-slate-50">{s.title}</span>
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 숫자 한눈에 */}
      <section id="facts" className="scroll-mt-24" aria-labelledby="facts-title">
        <h2 id="facts-title" className="mb-3 text-[17px] font-bold text-slate-50">
          갈레온 증권 숫자 한눈에
        </h2>
        <dl className="sheet grid grid-cols-1 overflow-hidden rounded-2xl sm:grid-cols-2">
          {QUICK_FACTS.map((f) => (
            <div key={f.label} className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-2.5 text-[13px] sm:odd:border-r">
              <dt>
                <a href={`#t-${f.term}`} className="text-slate-400 hover:text-magic-bright">
                  {f.label}
                </a>
              </dt>
              <dd className="text-right font-semibold text-slate-100 tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 용어 사전 */}
      <section id="glossary" className="scroll-mt-24" aria-labelledby="glossary-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="glossary-title" className="text-[17px] font-bold text-slate-50">
            용어 사전 <span className="text-[13px] font-medium text-slate-500">{GLOSSARY.length}개</span>
          </h2>
          <label className="relative w-full sm:w-56">
            <span className="sr-only">용어 검색</span>
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="용어 검색 (예: 반대매매)"
              className="field w-full !rounded-lg py-2 pl-8 pr-2 text-[13px] placeholder:text-slate-500"
            />
          </label>
        </div>
        <ChipGroup
          label="용어 분류"
          className="mb-3"
          value={cat}
          onChange={setCat}
          options={[{ key: "all" as CatFilter, label: "전체" }, ...CATEGORIES.map((c) => ({ key: c.key as CatFilter, label: c.label }))]}
        />
        {terms.length === 0 ? (
          <p className="sheet rounded-2xl px-4 py-10 text-center text-sm text-slate-500">찾는 용어가 없어요.</p>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {terms.map((t) => (
              <TermCard key={t.id} term={t} />
            ))}
          </div>
        )}
      </section>

      {/* 꿀팁 · 주의 */}
      <section id="tips" className="scroll-mt-24" aria-labelledby="tips-title">
        <h2 id="tips-title" className="mb-3 text-[17px] font-bold text-slate-50">
          꿀팁 · 주의
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TIPS.map((tip) => (
            <li key={tip.title} className={`sheet rounded-2xl p-4 ${tip.tone === "warn" ? "!border-rise/20" : "!border-sky/15"}`}>
              <p className="flex items-center gap-2 text-[14.5px] font-bold text-slate-50">
                <span aria-hidden>{tip.tone === "warn" ? "⚠️" : "💡"}</span>
                {tip.title}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{tip.body}</p>
              <a href={`#t-${tip.term}`} className="mt-2 inline-block text-[12px] text-slate-500 underline decoration-dotted underline-offset-4 hover:text-magic-bright">
                관련 용어 보기
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-slate-600">
          갈레온은 게임 속 화폐예요. 실제 투자는 원금 손실이 날 수 있으니, 여기서 익힌 규칙을 바탕으로 신중하게 판단하세요.
        </p>
      </section>
    </div>
  );
}

function TermCard({ term: t }: { term: GlossaryTerm }) {
  const catLabel = CATEGORIES.find((c) => c.key === t.category)?.label;
  return (
    <article id={`t-${t.id}`} className="sheet scroll-mt-24 rounded-2xl p-4 target:ring-2 target:ring-magic/60">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="text-[16px] font-bold text-slate-50">{t.term}</h3>
        {t.aka && <span className="text-[12px] text-slate-500">{t.aka}</span>}
        <span className="ml-auto text-[11px] font-medium text-slate-600">{catLabel}</span>
      </header>
      <p className="mt-2 text-[13.5px] leading-relaxed text-slate-200">{t.plain}</p>
      <div className="mt-3 space-y-2">
        <div className="rounded-xl bg-magic/[0.07] px-3 py-2.5 ring-1 ring-inset ring-magic/15">
          <p className="text-[11.5px] font-bold text-magic-bright">🪄 이 사이트에서는</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-300">{t.here}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-inset ring-white/8">
          <p className="text-[11.5px] font-bold text-slate-300">🏦 실제 주식시장에서는</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">{t.real}</p>
        </div>
        {t.example && (
          <p className="rounded-xl border border-dashed border-gold/25 px-3 py-2 text-[12.5px] leading-relaxed text-gold-bright/90">
            <span className="font-bold">예시 · </span>
            {t.example}
          </p>
        )}
      </div>
    </article>
  );
}
