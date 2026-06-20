import { useEffect, useRef, useMemo } from "react";
import type { PriceBar } from "@/lib/api";
import { getChartTheme } from "@/lib/chart-theme";
import { abbreviateNum } from "@/lib/formatters";
import { echarts, CHART_GROUP, connectCharts } from "@/lib/echarts";
import { useDarkMode } from "@/hooks/useDarkMode";

const SERIES_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

interface Props {
  series: { symbol: string; data: PriceBar[] }[];
  height?: number;
}

export function MultiSymbolOverlayChart({ series, height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const { dark } = useDarkMode();

  const normalized = useMemo(() => {
    const allDates = new Set<string>();
    const perSym: { symbol: string; baseClose: number; map: Map<string, number>; volMap: Map<string, number> }[] = [];

    for (const { symbol, data } of series) {
      if (data.length === 0) continue;
      const baseClose = data[0].close;
      const map = new Map<string, number>();
      const volMap = new Map<string, number>();
      for (const bar of data) {
        allDates.add(bar.time);
        map.set(bar.time, baseClose ? ((bar.close / baseClose) * 100) : 100);
        volMap.set(bar.time, bar.volume);
      }
      perSym.push({ symbol, baseClose, map, volMap });
    }

    const dates = [...allDates].sort();
    return { dates, perSym };
  }, [series]);

  useEffect(() => {
    if (!containerRef.current || normalized.perSym.length === 0) return;
    const chart = echarts.init(containerRef.current);
    chart.group = CHART_GROUP;
    connectCharts();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.dispose(); chartRef.current = null; };
  }, [normalized.perSym.length === 0, dark]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || normalized.perSym.length === 0) return;

    const t = getChartTheme();
    const { dates, perSym } = normalized;

    const lineSeries = perSym.map((s, i) => ({
      name: s.symbol,
      type: "line" as const,
      data: dates.map(d => s.map.get(d) ?? null),
      xAxisIndex: 0,
      yAxisIndex: 0,
      symbol: "none",
      lineStyle: { width: 1.5, color: SERIES_COLORS[i % SERIES_COLORS.length] },
      connectNulls: true,
    }));

    const volSeries = perSym.map((s, i) => ({
      name: `${s.symbol} Vol`,
      type: "bar" as const,
      data: dates.map(d => s.volMap.get(d) ?? 0),
      xAxisIndex: 1,
      yAxisIndex: 1,
      itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length] + "40" },
      barGap: "10%",
    }));

    const legendData = perSym.map(s => s.symbol);

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        textStyle: { color: t.tooltipText, fontSize: 11 },
      },
      toolbox: {
        feature: {
          saveAsImage: { title: "保存" },
          dataZoom: { title: { zoom: "缩放", back: "重置" } },
          restore: { title: "重置" },
        },
        right: 8, top: 0,
        iconStyle: { borderColor: t.textColor },
      },
      legend: {
        data: legendData,
        textStyle: { color: t.textColor, fontSize: 10 },
        right: 80, top: 2, type: "scroll", itemWidth: 12, itemHeight: 8, itemGap: 8,
      },
      grid: [
        { left: 8, right: 8, top: 36, height: "55%", containLabel: true },
        { left: 8, right: 8, top: "66%", height: "22%", containLabel: true },
      ],
      xAxis: [
        { type: "category", data: dates, gridIndex: 0, axisLine: { lineStyle: { color: t.axisColor } }, axisLabel: { color: t.textColor, fontSize: 10 }, boundaryGap: false },
        { type: "category", data: dates, gridIndex: 1, axisLine: { lineStyle: { color: t.axisColor } }, axisLabel: { show: false }, boundaryGap: false },
      ],
      yAxis: [
        {
          type: "value", gridIndex: 0,
          splitLine: { lineStyle: { color: t.gridColor } },
          axisLabel: { color: t.textColor, fontSize: 10, formatter: (v: number) => v.toFixed(0) },
        },
        {
          type: "value", gridIndex: 1,
          splitLine: { lineStyle: { color: t.gridColor } },
          axisLabel: { color: t.textColor, fontSize: 10, formatter: (v: number) => abbreviateNum(v) },
        },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1] },
        { type: "slider", xAxisIndex: [0, 1], bottom: 4, height: 20 },
      ],
      series: [...lineSeries, ...volSeries],
    }, true);
  }, [normalized, dark]);

  if (normalized.perSym.length === 0) {
    return <div className="text-muted-foreground text-sm p-4">无价格数据</div>;
  }

  return <div ref={containerRef} style={{ height }} />;
}