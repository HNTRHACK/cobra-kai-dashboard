"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, createChart, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type SeriesMarker, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { Segmented } from "@/components/ui/interactive";
import { LegendItem } from "@/components/ui/primitives";
import { useThemeColors } from "./useThemeColors";

export type MarketPoint = { t: number; o: number; h: number; l: number; c: number | null; v: number; vol: number; crash: number };
export type SignalSet = { key: string; label: string; signals: { t: number; s: number }[] };

const DAY = 86400;
const toTime = (t: number) => (t * DAY) as UTCTimestamp;
const fromTime = (time: Time) => Math.round(Number(time) / DAY);

type Range = "crash" | "300" | "all";

export default function MarketChart({ rows, signalSets, labeledThrough }: { rows: MarketPoint[]; signalSets: SignalSet[]; labeledThrough: number }) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const series = useRef<{ candle?: ISeriesApi<"Candlestick">; open?: ISeriesApi<"Line">; vol?: ISeriesApi<"Histogram">; volat?: ISeriesApi<"Line"> }>({});
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
  const colors = useThemeColors();
  const [range, setRange] = useState<Range>("crash");
  const [sigKey, setSigKey] = useState<string>(signalSets[0]?.key ?? "none");
  const [hover, setHover] = useState<number | null>(null);

  const byT = useMemo(() => new Map(rows.map((r) => [r.t, r])), [rows]);
  const sigMap = useMemo(() => new Map((signalSets.find((s) => s.key === sigKey)?.signals ?? []).map((x) => [x.t, x.s])), [signalSets, sigKey]);

  // create once
  useEffect(() => {
    if (!el.current || !colors) return;
    const chart = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: colors["fg-muted"], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, attributionLogo: false, panes: { separatorColor: colors.line, enableResize: false } },
      grid: { vertLines: { visible: false }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 4, minBarSpacing: 1, tickMarkFormatter: (time: Time) => `t${fromTime(time)}` },
      localization: { timeFormatter: (time: Time) => `t = ${fromTime(time)}` },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: colors["fg-muted"], labelBackgroundColor: colors.panel }, horzLine: { color: colors["fg-muted"], labelBackgroundColor: colors.panel } },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
    });
    chartRef.current = chart;
    const labeled = rows.filter((r) => r.c != null);
    const hidden = rows.filter((r) => r.c == null);
    const candle = chart.addSeries(CandlestickSeries, { priceLineVisible: false, lastValueVisible: false });
    candle.setData(labeled.map((r) => ({ time: toTime(r.t), open: r.o, high: r.h, low: r.l, close: r.c as number })));
    // hidden window: close is withheld → plot the permitted open price only, dashed
    const open = chart.addSeries(LineSeries, { lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, title: "open" });
    open.setData(hidden.map((r) => ({ time: toTime(r.t), value: r.o })));
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, 1);
    const volat = chart.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: "percent", precision: 2, minMove: 0.01 } }, 2);
    volat.setData(rows.map((r) => ({ time: toTime(r.t), value: r.vol * 100 })));
    const panes = chart.panes();
    panes[1]?.setHeight(78);
    panes[2]?.setHeight(78);
    series.current = { candle, open, vol, volat };
    markersRef.current = createSeriesMarkers(open, []);
    chart.subscribeCrosshairMove((p) => setHover(p.time ? fromTime(p.time) : null));
    return () => {
      chart.remove();
      chartRef.current = null;
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, colors == null]);

  // theme colours
  useEffect(() => {
    const chart = chartRef.current;
    const s = series.current;
    if (!chart || !colors || !s.candle) return;
    chart.applyOptions({
      layout: { textColor: colors["fg-muted"], panes: { separatorColor: colors.line } },
      grid: { horzLines: { color: colors.grid } },
      crosshair: { vertLine: { color: colors["fg-muted"], labelBackgroundColor: colors.panel }, horzLine: { color: colors["fg-muted"], labelBackgroundColor: colors.panel } },
    });
    s.candle.applyOptions({ upColor: colors.long, downColor: colors.short, borderUpColor: colors.long, borderDownColor: colors.short, wickUpColor: colors.long, wickDownColor: colors.short });
    s.open?.applyOptions({ color: colors.accent });
    s.volat?.applyOptions({ color: colors.accent });
    s.vol?.setData(rows.map((r) => ({ time: toTime(r.t), value: r.v, color: r.crash ? colors.crash : colors["fg-muted"] + "" })));
    s.vol?.applyOptions({ color: colors["fg-muted"] });
  }, [colors, rows]);

  // markers: flash-crash annotation + selected strategy's signals
  useEffect(() => {
    if (!markersRef.current || !colors) return;
    const m: SeriesMarker<Time>[] = [];
    const first = labeledThrough + 1;
    m.push({ time: toTime(first), position: "aboveBar", shape: "square", color: colors.crash, text: "Flash crash · close withheld", size: 1 });
    for (const [t, s] of [...sigMap.entries()].sort((a, b) => a[0] - b[0])) {
      if (s === 0) continue;
      if (t === first) continue;
      m.push({ time: toTime(t), position: s > 0 ? "belowBar" : "aboveBar", shape: s > 0 ? "arrowUp" : "arrowDown", color: s > 0 ? colors.long : colors.short, size: 0.6 + Math.min(1, Math.abs(s) * 2) });
    }
    markersRef.current.setMarkers(m);
  }, [sigMap, colors, labeledThrough]);

  // range controls
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const last = rows[rows.length - 1].t;
    const from = range === "all" ? rows[0].t : range === "300" ? last - 300 : labeledThrough - 60;
    chart.timeScale().setVisibleRange({ from: toTime(from), to: toTime(last) });
  }, [range, rows, labeledThrough, colors == null]);

  const h = hover != null ? byT.get(hover) : rows[rows.length - 1];
  const sig = h ? sigMap.get(h.t) : undefined;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Range>
          label="Time range"
          value={range}
          onChange={setRange}
          options={[
            { value: "crash", label: "Crash window" },
            { value: "300", label: "Last 300" },
            { value: "all", label: "All 900" },
          ]}
        />
        <Segmented<string>
          label="Signal markers"
          size="sm"
          value={sigKey}
          onChange={setSigKey}
          options={[...signalSets.map((s) => ({ value: s.key, label: s.label })), { value: "none", label: "No markers" }]}
        />
      </div>
      <div className="relative">
        {/* live readout (crosshair) */}
        <div className="pointer-events-none absolute top-1 left-1 z-10 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-panel/85 px-2.5 py-1.5 text-[11px] backdrop-blur num">
          {h && (
            <>
              <span className="text-fg">t {h.t}</span>
              <span className="text-fg-muted">O {h.o.toFixed(2)}</span>
              <span className="text-fg-muted">H {h.h.toFixed(2)}</span>
              <span className="text-fg-muted">L {h.l.toFixed(2)}</span>
              <span className="text-fg-muted">C {h.c == null ? "withheld" : h.c.toFixed(2)}</span>
              <span className="text-fg-muted">σ20 {(h.vol * 100).toFixed(2)}%</span>
              {sig != null && <span className="text-fg">signal {sig > 0 ? "+" : ""}{sig.toFixed(3)}</span>}
              {h.crash === 1 && <span className="text-fg">crash flag</span>}
            </>
          )}
        </div>
        <div ref={el} className="h-[460px] w-full sm:h-[520px]" role="img" aria-label="GLACIER_GAS candlestick chart with volume and volatility panes; hidden window shows the open price only" />
        {!colors && <div className="skeleton absolute inset-0 rounded-xl" aria-hidden />}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <LegendItem color="var(--long)" label="Up candle / long" />
        <LegendItem color="var(--short)" label="Down candle / short / crash volume" />
        <LegendItem color="var(--accent)" label="Open price, 851–900 (close withheld)" dashed />
        <LegendItem color="var(--accent)" label="Volatility (σ20) pane" />
      </div>
    </div>
  );
}
