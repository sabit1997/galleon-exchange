"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket, type LiveStock } from "@/components/providers/market-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Empty, MeChip, SkeletonRows } from "@/components/ui/card";
import { ChangePct, toneClass } from "@/components/ui/galleon";
import { ChevronRightIcon, SearchIcon } from "@/components/ui/icons";
import { kstDate, kstDayStartIso, kstTime } from "@/components/ui/kst";
import { MiniChart } from "@/components/ui/mini-chart";
import { NEWS_KIND_LABEL, newsTone } from "@/components/news/news-kinds";
import { koUnit } from "@/components/ui/units";
import { Sparkline } from "@/components/ui/sparkline";
import { ChipGroup } from "@/components/ui/tabs";
import { LearnHint, Tag, TermLink } from "@/components/ui/tag";
import { useNow } from "@/hooks/use-now";
import type { MarketNews } from "@/lib/database.types";
import { HOUSE_STYLES, formatGalleon, houseKey, type HouseKey } from "@/lib/format";
import { changeRatio, direction, priceBounds } from "@/lib/market";

// ───────────────────────────── 공통 ─────────────────────────────

const HOUSES = ["gryffindor", "slytherin", "ravenclaw", "hufflepuff"] as const;
const HOUSE_RANK: Record<HouseKey, number> = { gryffindor: 0, slytherin: 1, ravenclaw: 2, hufflepuff: 3, none: 4 };

const idxFmt = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 부호 붙은 가격 차이 (▲12 · ▼5 · 0) */
function SignedDiff({ value, className = "" }: { value: number; className?: string }) {
  const d = direction(value);
  return (
    <span className={`tabular-nums ${toneClass(value)} ${className}`}>
      {d === "up" ? "▲" : d === "down" ? "▼" : ""}
      {formatGalleon(Math.abs(value))}
    </span>
  );
}

// ───────────────────────────── 데이터 훅 ─────────────────────────────

type IndexSeries = Map<string, number[]>;

/** 오늘(00:00 KST 부터) 지수 5분 스냅샷. 새 스냅샷은 실시간으로 붙인다. */
function useTodayIndexTicks(scopes: string[]): IndexSeries {
  const { supabase, guildId } = useMemberSession();
  const now = useNow(60_000);
  const dayStart = kstDayStartIso(now);
  const scopeKey = scopes.join("|");
  const [series, setSeries] = useState<IndexSeries>(new Map());

  useEffect(() => {
    const list = scopeKey ? scopeKey.split("|") : [];
    if (list.length === 0) return;
    let cancelled = false;
    const load = async () => {
      // 범위마다 따로 읽는다 (하루 288개 × 범위 수가 한 번의 응답 한도를 넘지 않게)
      const results = await Promise.all(
        list.map((scope) =>
          supabase
            .from("index_ticks")
            .select("id, scope, value, created_at")
            .eq("guild_id", guildId)
            .eq("scope", scope)
            .gte("created_at", dayStart)
            .order("id", { ascending: true })
            .limit(400),
        ),
      );
      if (cancelled) return;
      const next: IndexSeries = new Map();
      results.forEach((res, i) => next.set(list[i], (res.data ?? []).map((t) => Number(t.value))));
      setSeries(next);
    };
    const channel = supabase
      .channel(`board-index:${guildId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "index_ticks", filter: `guild_id=eq.${guildId}` }, (p) => {
        const row = p.new as { scope: string; value: number; created_at: string };
        if (Date.parse(row.created_at) < Date.parse(dayStart)) return;
        setSeries((prev) => new Map(prev).set(row.scope, [...(prev.get(row.scope) ?? []), Number(row.value)]));
      })
      .subscribe((status) => {
        if (status !== "CLOSED") void load();
      });
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId, dayStart, scopeKey]);

  return series;
}

type DayCandle = { volume: number; value: number; high: number; low: number };

/** 오늘 일봉 (거래량 · 거래대금 · 고가 · 저가). 30초마다 다시 읽는다. */
function useTodayCandles(): Map<string, DayCandle> {
  const { supabase, guildId } = useMemberSession();
  const now = useNow(60_000);
  const day = kstDate(now);
  const [candles, setCandles] = useState<Map<string, DayCandle>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("candles")
        .select("discord_id, volume, value, high, low")
        .eq("guild_id", guildId)
        .eq("day", day);
      if (cancelled || error) return;
      setCandles(
        new Map(
          data.map((c) => [c.discord_id, { volume: Number(c.volume), value: Number(c.value), high: Number(c.high), low: Number(c.low) }]),
        ),
      );
    };
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [supabase, guildId, day]);

  return candles;
}

/** 최신 시장 뉴스 몇 건 (실시간) */
function useLatestNews(limit: number): MarketNews[] | null {
  const { supabase, guildId } = useMemberSession();
  const [news, setNews] = useState<MarketNews[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("market_news").select("*").eq("guild_id", guildId).order("id", { ascending: false }).limit(limit);
      if (!cancelled) setNews(data ?? []);
    };
    const channel = supabase
      .channel(`board-news:${guildId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_news", filter: `guild_id=eq.${guildId}` }, (p) => {
        const row = p.new as MarketNews;
        setNews((prev) => [row, ...(prev ?? []).filter((n) => n.id !== row.id)].slice(0, limit));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "market_news", filter: `guild_id=eq.${guildId}` }, (p) => {
        const row = p.new as MarketNews;
        setNews((prev) => prev?.map((n) => (n.id === row.id ? row : n)) ?? prev);
      })
      .subscribe((status) => {
        if (status !== "CLOSED") void load();
      });
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId, limit]);
  return news;
}

// ───────────────────────────── 화면 ─────────────────────────────

type SortKey = "gainers" | "losers" | "volume" | "cap" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "gainers", label: "상승률 상위" },
  { key: "losers", label: "하락률 상위" },
  { key: "volume", label: "거래량" },
  { key: "cap", label: "시가총액" },
  { key: "name", label: "이름순" },
];

type HouseFilter = "all" | (typeof HOUSES)[number];

export function MarketBoard() {
  const { stocks, sparks, indices, loading, error } = useMarket();
  const [sort, setSort] = useState<SortKey>("gainers");
  const [house, setHouse] = useState<HouseFilter>("all");
  const [query, setQuery] = useState("");
  const candles = useTodayCandles();

  const scopes = useMemo(
    () =>
      [...indices.keys()].sort((a, b) => {
        if (a === "all") return -1;
        if (b === "all") return 1;
        return HOUSE_RANK[houseKey(a)] - HOUSE_RANK[houseKey(b)];
      }),
    [indices],
  );
  const indexSeries = useTodayIndexTicks(scopes);

  const all = useMemo(() => [...stocks.values()], [stocks]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = all.filter(
      (s) => (house === "all" || houseKey(s.house) === house) && (!q || s.display_name.toLowerCase().includes(q)),
    );
    const vol = (s: LiveStock) => candles.get(s.discord_id)?.volume ?? 0;
    const ratio = (s: LiveStock) => changeRatio(s.price, s.day_open);
    arr.sort((a, b) => {
      switch (sort) {
        case "gainers":
          return ratio(b) - ratio(a);
        case "losers":
          return ratio(a) - ratio(b);
        case "volume":
          return vol(b) - vol(a) || ratio(b) - ratio(a);
        case "cap":
          return b.price - a.price;
        case "name":
          return a.display_name.localeCompare(b.display_name, "ko");
      }
    });
    return arr;
  }, [all, house, query, sort, candles]);

  const breadth = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const s of all) {
      const d = direction(s.price - s.day_open);
      if (d === "up") up++;
      else if (d === "down") down++;
    }
    let value = 0;
    for (const c of candles.values()) value += c.value;
    return { up, down, flat: all.length - up - down, value };
  }, [all, candles]);

  return (
    <div className="space-y-4">
      <h1 className="sr-only">갈레온 증권 시장</h1>

      <IndexPanel scopes={scopes} series={indexSeries} loading={loading} />

      <NewsTicker />

      <section className="sheet overflow-hidden rounded-2xl" aria-labelledby="quote-title">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-4 pb-1 pt-4 sm:px-5">
          <h2 id="quote-title" className="text-[17px] font-bold text-slate-50">
            실시간 시세
          </h2>
          <p className="text-[12px] text-slate-500 tabular-nums">
            상승 <span className="font-semibold text-rise">{breadth.up}</span> · 보합 <span className="font-semibold text-slate-300">{breadth.flat}</span> ·
            하락 <span className="font-semibold text-fall">{breadth.down}</span>
            <span className="mx-1.5 text-slate-700">|</span>
            오늘 거래대금 <span className="font-semibold text-slate-300">{koUnit(breadth.value)}</span>
          </p>
        </div>

        <div className="space-y-2.5 px-4 pb-3 pt-2 sm:px-5">
          <ChipGroup label="정렬" options={SORTS} value={sort} onChange={setSort} />
          <div className="flex items-center gap-2">
            <ChipGroup
              label="기숙사(업종) 필터"
              className="min-w-0 flex-1"
              value={house}
              onChange={setHouse}
              options={[
                { key: "all", label: "전체 업종" },
                ...HOUSES.map((h) => ({
                  key: h,
                  label: (
                    <>
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${HOUSE_STYLES[h].dot}`} />
                      {HOUSE_STYLES[h].label}
                    </>
                  ),
                })),
              ]}
            />
            <label className="relative hidden w-44 shrink-0 sm:block">
              <span className="sr-only">종목 검색</span>
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="종목 검색"
                className="field w-full !rounded-lg py-1.5 pl-8 pr-2 text-[13px] placeholder:text-slate-500"
              />
            </label>
          </div>
          <label className="relative block sm:hidden">
            <span className="sr-only">종목 검색</span>
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목 검색"
              className="field w-full !rounded-lg py-2 pl-8 pr-2 text-[13px] placeholder:text-slate-500"
            />
          </label>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <Empty>시장 정보를 불러오지 못했어요. ({error})</Empty>
        ) : list.length === 0 ? (
          <Empty>{query || house !== "all" ? "조건에 맞는 종목이 없어요." : "아직 상장된 학생이 없어요. 첫 교시를 완주해 보세요!"}</Empty>
        ) : (
          <QuoteTable list={list} sparks={sparks} candles={candles} sort={sort} />
        )}

        <div className="border-t border-white/5 px-4 py-3 sm:px-5">
          <LearnHint term="base-price">
            등락률은 <b className="font-semibold text-slate-100">기준가</b>(오늘 00:00 시가)와 비교한 값이에요. 하루에 기준가 ±30%까지만 움직이고, 끝에 닿으면{" "}
            <b className="font-semibold text-rise">상한가</b>·<b className="font-semibold text-fall">하한가</b>예요.
          </LearnHint>
        </div>
      </section>
    </div>
  );
}

// ───────────────────────────── 지수 ─────────────────────────────

function IndexPanel({ scopes, series, loading }: { scopes: string[]; series: IndexSeries; loading: boolean }) {
  const { indices, indexValue } = useMarket();
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6" aria-label="지수 불러오는 중">
        <span className="skeleton col-span-2 h-[132px] !rounded-2xl" />
        {HOUSES.map((h) => (
          <span key={h} className="skeleton h-[100px] !rounded-2xl" />
        ))}
      </div>
    );
  }
  if (scopes.length === 0) return null;
  return (
    <section aria-label="지수" className="grid grid-cols-2 gap-2 md:grid-cols-6">
      {scopes.map((scope) => {
        const value = indexValue(scope);
        const open = indices.get(scope)?.day_open ?? 0;
        if (value == null) return null;
        const points = [...(series.get(scope) ?? []), value];
        return <IndexCard key={scope} scope={scope} value={value} open={Number(open)} points={points} />;
      })}
    </section>
  );
}

function IndexCard({ scope, value, open, points }: { scope: string; value: number; open: number; points: number[] }) {
  const main = scope === "all";
  const diff = value - open;
  const r = changeRatio(value, open);
  const key = houseKey(scope);
  return (
    <div className={`sheet relative overflow-hidden rounded-2xl ${main ? "col-span-2 p-4" : "px-3 pb-2.5 pt-3"}`}>
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
        {main ? (
          <>
            <span className="font-semibold text-slate-200">호그와트 종합지수</span>
            <TermLink id="index" />
          </>
        ) : (
          <>
            <span aria-hidden className={`h-2 w-2 rounded-full ${HOUSE_STYLES[key].dot}`} />
            <span className="truncate">{HOUSE_STYLES[key].label}</span>
          </>
        )}
      </p>
      <p className={`mt-1 font-bold tabular-nums ${toneClass(diff)} ${main ? "text-[26px] leading-tight" : "text-[17px]"}`}>{idxFmt.format(value)}</p>
      <p className={`tabular-nums ${main ? "text-[13px]" : "text-[11.5px]"}`}>
        <SignedDiff value={Math.round(diff * 100) / 100} className="mr-1.5" />
        <ChangePct ratio={r} />
      </p>
      <MiniChart values={points} base={open} height={main ? 44 : 26} className="mt-2" label={`${main ? "종합" : HOUSE_STYLES[key].label} 지수 오늘 흐름`} />
      {main && <p className="mt-1 text-[10.5px] text-slate-600">오늘 00:00 기준 · 5분 간격 · 점선 = 시가</p>}
    </div>
  );
}

// ───────────────────────────── 뉴스 띠 ─────────────────────────────

function NewsTicker() {
  const news = useLatestNews(8);
  if (!news || news.length === 0) return null;
  const items = news.map((n) => (
    <span key={n.id} className="mr-8 inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-[11px] text-slate-500 tabular-nums">{kstTime(n.created_at)}</span>
      <Tag tone={newsTone(n.kind)}>
        {NEWS_KIND_LABEL[n.kind]}
      </Tag>
      <span className="text-[13px] text-slate-200">{n.headline}</span>
      {n.pct != null && Number(n.pct) !== 0 && <ChangePct ratio={Number(n.pct)} className="text-[12px]" />}
    </span>
  ));
  return (
    <Link href="/news" className="sheet group flex items-center gap-3 overflow-hidden rounded-xl py-2 pl-3 pr-2" aria-label="예언자 일보 실시간 뉴스 보기">
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-bold text-rise">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rise animate-pulse-dot" />
        속보
      </span>
      <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_4%,black_92%,transparent)]">
        <div className="marquee" style={{ ["--marquee-duration" as string]: `${Math.max(30, news.length * 9)}s` }}>
          <div className="flex">{items}</div>
          <div className="flex" aria-hidden>
            {items}
          </div>
        </div>
      </div>
      <ChevronRightIcon className="shrink-0 text-slate-500 group-hover:text-slate-200" />
    </Link>
  );
}

// ───────────────────────────── 시세표 ─────────────────────────────

function QuoteTable({
  list,
  sparks,
  candles,
  sort,
}: {
  list: LiveStock[];
  sparks: Map<string, number[]>;
  candles: Map<string, DayCandle>;
  sort: SortKey;
}) {
  const { config } = useMarket();
  const { holdings, credit, shorts } = useAccount();
  const { me } = useMemberSession();
  const router = useRouter();
  const now = useNow(5_000);
  const shares = config?.shares_outstanding ?? 0;
  // 모바일 오른쪽 칸: 정렬 기준에 맞는 값
  const mobileMetric = sort === "volume" ? "거래량" : sort === "cap" ? "시가총액" : "차트";

  return (
    <div className="scroll-x">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col" className="!pl-4 sm:!pl-5">
              종목명
            </th>
            <th scope="col">현재가</th>
            <th scope="col" className="hidden sm:table-cell">
              전일대비
            </th>
            <th scope="col" className="hidden sm:table-cell">
              등락률
            </th>
            <th scope="col" className="hidden sm:table-cell">
              거래량
            </th>
            <th scope="col" className="hidden sm:table-cell">
              시가총액
            </th>
            <th scope="col" className="hidden !pr-5 md:table-cell">
              흐름
            </th>
            <th scope="col" className="!pr-4 sm:hidden">
              {mobileMetric}
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const href = `/stocks/${encodeURIComponent(s.discord_id)}`;
            const diff = s.price - s.day_open;
            const ratio = changeRatio(s.price, s.day_open);
            const bounds = config ? priceBounds(config, s.day_open) : null;
            const atUpper = bounds != null && s.price >= bounds.hi;
            const atLower = bounds != null && s.price <= bounds.lo && bounds.lo > (config?.min_price ?? 0);
            const vi = s.vi_until != null && Date.parse(s.vi_until) > now;
            const held =
              (holdings.get(s.discord_id)?.qty ?? 0) + (credit.get(s.discord_id)?.qty ?? 0) + (shorts.get(s.discord_id)?.qty ?? 0) > 0;
            const candle = candles.get(s.discord_id);
            const volume = candle?.volume ?? 0;
            const flashClass = s.flashKey > 0 ? (s.flash === "up" ? "flash-up" : s.flash === "down" ? "flash-down" : "") : "";
            const key = houseKey(s.house);
            return (
              <tr key={s.discord_id} className="cursor-pointer" onClick={() => router.push(href)}>
                <td className="!pl-4 sm:!pl-5">
                  <div className="flex min-w-0 max-w-[150px] flex-col gap-0.5 sm:max-w-[220px]">
                    <span className="flex min-w-0 items-center gap-1">
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate font-sans text-[14px] font-semibold text-slate-100 hover:underline"
                      >
                        {s.display_name}
                      </Link>
                      {s.discord_id === me && <MeChip />}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1 font-sans text-[11px] text-slate-500">
                      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${HOUSE_STYLES[key].dot}`} />
                      <span className="truncate">{key === "none" && s.house ? s.house : HOUSE_STYLES[key].label}</span>
                      {atUpper && <Tag tone="rise">상한가</Tag>}
                      {atLower && <Tag tone="fall">하한가</Tag>}
                      {vi && (
                        <Tag tone="warn" title="변동성 완화장치 — 잠시 시장가 거래가 멈춰요">
                          VI
                        </Tag>
                      )}
                      {held && <Tag tone="gold">보유</Tag>}
                    </span>
                  </div>
                </td>
                <td>
                  {/* flashKey 가 바뀌면 다시 마운트되어 깜빡임이 재생된다 */}
                  <span key={s.flashKey} className={`inline-block rounded px-1 text-[14px] font-semibold ${toneClass(diff)} ${flashClass}`}>
                    {formatGalleon(s.price)}
                  </span>
                  <span className="block text-[11.5px] sm:hidden">
                    <ChangePct ratio={ratio} />
                  </span>
                </td>
                <td className="hidden sm:table-cell">
                  <SignedDiff value={diff} />
                </td>
                <td className="hidden sm:table-cell">
                  <ChangePct ratio={ratio} className="font-medium" />
                </td>
                <td className="hidden text-slate-300 sm:table-cell">{formatGalleon(volume)}</td>
                <td className="hidden text-slate-300 sm:table-cell">{shares ? koUnit(s.price * shares) : "-"}</td>
                <td className="hidden !pr-5 md:table-cell">
                  <Sparkline prices={sparks.get(s.discord_id) ?? []} width={64} height={22} className="ml-auto" />
                </td>
                <td className="!pr-4 sm:hidden">
                  {mobileMetric === "거래량" ? (
                    <span className="text-[12.5px] text-slate-300">{formatGalleon(volume)}</span>
                  ) : mobileMetric === "시가총액" ? (
                    <span className="text-[12.5px] text-slate-300">{shares ? koUnit(s.price * shares) : "-"}</span>
                  ) : (
                    <Sparkline prices={sparks.get(s.discord_id) ?? []} width={52} height={22} className="ml-auto" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
