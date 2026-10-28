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
        textColor: "#b8a581",
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(226,189,104,0.08)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#43382a" }, vertLine: { labelBackgroundColor: "#43382a" } },
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
    const line = up ? "#f47a6e" : "#72aaf2";
    series.applyOptions({
      lineColor: line,
      topColor: up ? "rgba(244,122,110,0.35)" : "rgba(114,170,242,0.35)",
      bottomColor: "rgba(0,0,0,0)",
    });
    series.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    chartRef.current?.timeScale().fitContent();
  }, [points, up]);

  return <div ref={containerRef} className="h-64 w-full sm:h-80" aria-label="주가 차트" role="img" />;
}
