"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "@/lib/database.types";
import { formatGalleon } from "@/lib/format";
import {
  applyLiveIntraday,
  buildDailyBars,
  buildIntradayBars,
  kstSeconds,
  movingAverage,
  weeklyBars,
  type Bar,
} from "@/components/stock/chart-data";
import { HelpTip } from "@/components/stock/help-tip";
import type { TickRow, TradeRow } from "@/components/stock/use-stock-data";

const UP = "#ff6b6b";
const DOWN = "#5b9bff";
const MA5 = "#f5c451";
const MA20 = "#b49bff";

type Tab = "5m" | "1d" | "1w";
const TABS: { key: Tab; label: string }[] = [
  { key: "5m", label: "5분" },
  { key: "1d", label: "일" },
  { key: "1w", label: "주" },
];

/**
 * 캔들 차트. 5분봉은 최근 틱 · 체결로, 일봉 · 주봉은 candles 로 만든다.
 * 실시간 주가(price · updatedAt)가 바뀌면 마지막 봉을 고친다.
 */
export function PriceChart({
  ticks,
  trades,
  candles,
  price,
  dayOpen,
  updatedAt,
  today,
}: {
  ticks: TickRow[] | null;
  trades: TradeRow[] | null;
  candles: Candle[] | null;
  price: number;
  dayOpen: number;
  updatedAt: string;
  /** KST 오늘 'YYYY-MM-DD' */
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("5m");

  const intraday = useMemo(() => (ticks && trades ? buildIntradayBars(ticks, trades) : null), [ticks, trades]);

  const bars = useMemo(() => {
    if (tab === "5m") {
      if (!intraday) return null;
      const t = kstSeconds(updatedAt);
      return Number.isNaN(t) ? intraday : applyLiveIntraday(intraday, price, t);
    }
    if (!candles) return null;
    const live = buildDailyBars(candles, { day: today, price, dayOpen });
    return tab === "1d" ? live : weeklyBars(live);
  }, [tab, intraday, candles, price, dayOpen, updatedAt, today]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-white/[0.04] p-0.5 text-xs" role="tablist" aria-label="차트 주기">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1 font-semibold ${tab === t.key ? "bg-white/12 text-slate-50" : "text-slate-400 hover:text-slate-200"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <i className="h-0.5 w-3 rounded" style={{ background: MA5 }} />
            MA5
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-0.5 w-3 rounded" style={{ background: MA20 }} />
            MA20
          </span>
          <HelpTip text="캔들 하나가 한 구간(5분·하루·한 주)이에요. 빨간 봉은 시작보다 끝 가격이 오른 것(양봉), 파란 봉은 내린 것(음봉)이에요. 위아래 꼬리는 그 구간의 고가·저가예요. MA5·MA20은 최근 5개·20개 봉 종가의 평균(이동평균선), 아래 막대는 거래량이에요." />
        </div>
      </div>
      {bars === null ? (
        <div className="skeleton h-72 w-full !rounded-xl sm:h-[22rem]" role="status" aria-label="차트 불러오는 중" />
      ) : bars.length === 0 ? (
        <div className="grid h-72 place-items-center text-sm text-slate-500 sm:h-[22rem]">아직 이 구간에 거래 기록이 없어요.</div>
      ) : (
        <CandleChart key={tab} bars={bars} intraday={tab === "5m"} basePrice={dayOpen} />
      )}
    </div>
  );
}

type Legend = { open: number; high: number; low: number; close: number; volume: number };

function CandleChart({ bars, intraday, basePrice }: { bars: Bar[]; intraday: boolean; basePrice: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma5Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const fittedRef = useRef(false);
  const volumeByTime = useRef(new Map<Time, number>());
  const [hover, setHover] = useState<Legend | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8d92b4",
        fontSize: 11,
        fontFamily: getComputedStyle(el).fontFamily,
        attributionLogo: false,
      },
      localization: {
        locale: "ko-KR",
        priceFormatter: (p: number) => formatGalleon(p),
      },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.05)" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.26 } },
      timeScale: { borderVisible: false, timeVisible: intraday, secondsVisible: false, rightOffset: 3 },
      crosshair: {
        mode: CrosshairMode.Normal,
        horzLine: { color: "rgba(196,186,255,0.35)", labelBackgroundColor: "#333652" },
        vertLine: { color: "rgba(196,186,255,0.35)", labelBackgroundColor: "#333652" },
      },
      // 휠 · 세로 스와이프는 페이지 스크롤에 양보한다
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 }, visible: false });
    const lineOpts = { lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as const;
    const ma5 = chart.addSeries(LineSeries, { ...lineOpts, color: MA5 });
    const ma20 = chart.addSeries(LineSeries, { ...lineOpts, color: MA20 });

    const onMove = (param: MouseEventParams<Time>) => {
      const d = param.seriesData.get(candle) as CandlestickData<Time> | undefined;
      if (!param.time || !d) {
        setHover(null);
        return;
      }
      setHover({ open: d.open, high: d.high, low: d.low, close: d.close, volume: volumeByTime.current.get(param.time) ?? 0 });
    };
    chart.subscribeCrosshairMove(onMove);

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;
    ma5Ref.current = ma5;
    ma20Ref.current = ma20;
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      ma5Ref.current = null;
      ma20Ref.current = null;
    };
  }, [intraday]);

  // 기준가 점선 (분봉에서만 — 일봉은 날마다 기준가가 다르다)
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle || !intraday) return;
    const line = candle.createPriceLine({
      price: basePrice,
      color: "rgba(183,187,216,0.45)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: "기준가",
    });
    return () => candle.removePriceLine(line);
  }, [basePrice, intraday]);

  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    if (!candle || !volume) return;
    const t = (b: Bar) => b.time as Time;
    candle.setData(bars.map((b) => ({ time: t(b), open: b.open, high: b.high, low: b.low, close: b.close })));
    volume.setData(
      bars.map((b) => ({
        time: t(b),
        value: b.volume,
        color: b.close >= b.open ? "rgba(255,107,107,0.45)" : "rgba(91,155,255,0.45)",
      })),
    );
    volumeByTime.current = new Map(bars.map((b) => [t(b), b.volume]));
    ma5Ref.current?.setData(movingAverage(bars, 5).map((p) => ({ time: p.time as Time, value: p.value })));
    ma20Ref.current?.setData(movingAverage(bars, 20).map((p) => ({ time: p.time as Time, value: p.value })));
    if (!fittedRef.current) {
      fittedRef.current = true;
      const ts = chartRef.current?.timeScale();
      const show = intraday ? 72 : 60;
      if (bars.length > show) ts?.setVisibleLogicalRange({ from: bars.length - show, to: bars.length + 2 });
      else ts?.fitContent();
    }
  }, [bars, intraday]);

  const last = bars[bars.length - 1];
  const shown: Legend = hover ?? { open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume };
  const tone = shown.close >= shown.open ? "text-rise" : "text-fall";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-1 top-0 z-10 flex flex-wrap gap-x-2.5 text-[11px] tabular-nums text-slate-400">
        <span>
          시 <b className={`font-medium ${tone}`}>{formatGalleon(shown.open)}</b>
        </span>
        <span>
          고 <b className="font-medium text-rise">{formatGalleon(shown.high)}</b>
        </span>
        <span>
          저 <b className="font-medium text-fall">{formatGalleon(shown.low)}</b>
        </span>
        <span>
          종 <b className={`font-medium ${tone}`}>{formatGalleon(shown.close)}</b>
        </span>
        <span>
          량 <b className="font-medium text-slate-300">{formatGalleon(shown.volume)}</b>
        </span>
      </div>
      <div ref={containerRef} className="h-72 w-full pt-4 sm:h-[22rem]" aria-label="주가 캔들 차트" role="img" />
    </div>
  );
}
