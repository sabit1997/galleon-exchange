"use client";

import { AreaSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

export type ChartPoint = { time: number; value: number };

/** 주가 영역 차트. points 의 time 은 초 단위(이미 KST 로 밀어 둔 값). */
export function PriceChart({ points, up }: { points: ChartPoint[]; up: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8d92b4",
        // next/font 가 붙인 실제 글꼴 이름을 그대로 쓴다
        fontFamily: getComputedStyle(el).fontFamily,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.05)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        horzLine: { color: "rgba(196,186,255,0.35)", labelBackgroundColor: "#333652" },
        vertLine: { color: "rgba(196,186,255,0.35)", labelBackgroundColor: "#333652" },
      },
      handleScroll: false,
      handleScale: false,
    });
    seriesRef.current = chart.addSeries(AreaSeries, {
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const line = up ? "#ff6b6b" : "#5b9bff";
    series.applyOptions({
      lineColor: line,
      topColor: up ? "rgba(255,107,107,0.3)" : "rgba(91,155,255,0.3)",
      bottomColor: "rgba(0,0,0,0)",
    });
    series.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    chartRef.current?.timeScale().fitContent();
  }, [points, up]);

  return <div ref={containerRef} className="h-64 w-full sm:h-80" aria-label="주가 차트" role="img" />;
}
