"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { Segmented } from "@/components/ui/interactive";
import { LegendItem } from "@/components/ui/primitives";
import { TipCard, axis } from "./kit";
import { V } from "./useThemeColors";

type RegimeRow = { t: number; vol: number; crash: number; regime: "normal" | "elevated" | "crash"; vz: number; rsi: number };

function spans(rows: RegimeRow[], key: "crash" | "elevated") {
  const out: [number, number][] = [];
  let start: number | null = null;
  rows.forEach((r, i) => {
    const on = key === "crash" ? r.regime === "crash" : r.regime === "elevated";
    if (on && start == null) start = r.t;
    if ((!on || i === rows.length - 1) && start != null) {
      out.push([start, on ? r.t : rows[i - 1].t]);
      start = null;
    }
  });
  return out;
}

/** Volatility with regime shading: normal → elevated → crash (Overview + Regimes). */
export function VolRegimeChart({ rows, labeledThrough, height = 280 }: { rows: RegimeRow[]; labeledThrough: number; height?: number }) {
  const data = useMemo(() => rows.map((r) => ({ t: r.t, vol: r.vol * 100, regime: r.regime })), [rows]);
  const crash = useMemo(() => spans(rows, "crash"), [rows]);
  const elev = useMemo(() => spans(rows, "elevated"), [rows]);
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="volfill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={V.accent} stopOpacity={0.28} />
                <stop offset="100%" stopColor={V.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            {elev.map(([a, b]) => (
              <ReferenceArea key={`e${a}`} x1={a} x2={b} fill={V.elevated} fillOpacity={0.08} strokeOpacity={0} ifOverflow="hidden" />
            ))}
            {crash.map(([a, b]) => (
              <ReferenceArea key={`c${a}`} x1={a} x2={b} fill={V.crash} fillOpacity={0.16} strokeOpacity={0} ifOverflow="hidden" />
            ))}
            <ReferenceLine x={labeledThrough + 0.5} stroke={V.fg} strokeDasharray="3 4" label={{ value: "labels end · t850", position: "insideTopLeft", fill: V.muted, fontSize: 11 }} />
            <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} {...axis} minTickGap={40} />
            <YAxis {...axis} width={44} tickFormatter={(v) => `${v.toFixed(1)}%`} />
            <Tooltip
              cursor={{ stroke: V.muted, strokeDasharray: "3 3" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipCard
                    title={`t = ${payload[0].payload.t}`}
                    rows={[
                      { color: V.accent, label: "σ20 volatility", value: `${(payload[0].value as number).toFixed(2)}%` },
                      { label: "Regime", value: payload[0].payload.regime },
                    ]}
                  />
                ) : null
              }
            />
            <Area type="monotone" dataKey="vol" stroke={V.accent} strokeWidth={2} fill="url(#volfill)" isAnimationActive={false} activeDot={{ r: 4, stroke: V.panel, strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <LegendItem color={V.accent} label="σ20 volatility" />
        <span className="inline-flex items-center gap-2 text-xs text-fg-muted"><span aria-hidden className="h-3 w-4 rounded-sm" style={{ background: "color-mix(in oklab, var(--elevated) 30%, transparent)" }} />Elevated (vol z &gt; 1)</span>
        <span className="inline-flex items-center gap-2 text-xs text-fg-muted"><span aria-hidden className="h-3 w-4 rounded-sm" style={{ background: "color-mix(in oklab, var(--crash) 45%, transparent)" }} />Crash flag</span>
      </div>
    </div>
  );
}

/** One-row regime timeline across all 900 timestamps. */
export function RegimeStrip({ rows }: { rows: RegimeRow[] }) {
  const counts = rows.reduce((a, r) => ((a[r.regime] = (a[r.regime] ?? 0) + 1), a), {} as Record<string, number>);
  return (
    <div>
      <div className="flex h-10 w-full overflow-hidden rounded-lg border border-line" role="img" aria-label={`Regime timeline: ${counts.normal ?? 0} normal, ${counts.elevated ?? 0} elevated, ${counts.crash ?? 0} crash rows`}>
        {rows.map((r) => (
          <div
            key={r.t}
            title={`t ${r.t} · ${r.regime}`}
            className="h-full flex-1"
            style={{ background: r.regime === "crash" ? V.crash : r.regime === "elevated" ? "color-mix(in oklab, var(--elevated) 70%, transparent)" : "color-mix(in oklab, var(--fg) 9%, transparent)" }}
          />
        ))}
      </div>
      <div className="num mt-2 flex justify-between text-[11px] text-fg-muted">
        <span>t1</span>
        <span>t450</span>
        <span>t900</span>
      </div>
    </div>
  );
}

export function VolumeShockChart({ rows }: { rows: RegimeRow[] }) {
  const data = rows.slice(-250).map((r) => ({ t: r.t, vz: r.vz }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" {...axis} minTickGap={36} />
          <YAxis {...axis} width={40} />
          <ReferenceLine y={2} stroke={V.muted} strokeDasharray="3 4" label={{ value: "z = 2", position: "insideTopRight", fill: V.muted, fontSize: 11 }} />
          <ReferenceLine y={0} stroke={V.line} />
          <Tooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`t = ${payload[0].payload.t}`} rows={[{ label: "Volume z-score (20d)", value: (payload[0].value as number).toFixed(2) }]} /> : null} />
          <Bar dataKey="vz" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.t} fill={Math.abs(d.vz) > 2 ? V.accent : "color-mix(in oklab, var(--fg) 28%, transparent)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RsiChart({ rows }: { rows: RegimeRow[] }) {
  const data = rows.slice(-250).map((r) => ({ t: r.t, rsi: r.rsi }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <ReferenceArea y1={70} y2={100} fill={V.fg} fillOpacity={0.04} />
          <ReferenceArea y1={0} y2={30} fill={V.fg} fillOpacity={0.04} />
          <ReferenceLine y={70} stroke={V.muted} strokeDasharray="3 4" />
          <ReferenceLine y={30} stroke={V.muted} strokeDasharray="3 4" />
          <XAxis dataKey="t" {...axis} minTickGap={36} />
          <YAxis {...axis} width={40} domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} />
          <Tooltip cursor={{ stroke: V.muted, strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`t = ${payload[0].payload.t}`} rows={[{ color: V.ridge, label: "RSI 14", value: (payload[0].value as number).toFixed(1) }]} /> : null} />
          <Line dataKey="rsi" stroke={V.ridge} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, stroke: V.panel, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Order-flow vs same-day return, Round 1 release vs organiser revision (801–850). Two panels, one scale each. */
export function OrderFlowRevision({ revision, summary }: {
  revision: { t: number; of_r1: number; of_r2: number; ret: number }[];
  summary: { corr_r1_window: number; corr_r2_window: number; corr_history: number };
}) {
  const panels = [
    { key: "of_r1" as const, title: "Round 1 release", corr: summary.corr_r1_window, color: V.short },
    { key: "of_r2" as const, title: "Organiser revision (Round 2 file)", corr: summary.corr_r2_window, color: V.ridge },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {panels.map((p) => (
        <figure key={p.key}>
          <figcaption className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">{p.title}</span>
            <span className="num text-xs text-fg-muted">corr {p.corr > 0 ? "+" : ""}{p.corr.toFixed(2)}</span>
          </figcaption>
          <div className="h-60">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey={p.key} name="order flow" {...axis} tickFormatter={(v) => v.toFixed(1)} />
                <YAxis type="number" dataKey="ret" name="return" {...axis} width={46} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <ZAxis range={[48, 48]} />
                <ReferenceLine x={0} stroke={V.line} />
                <ReferenceLine y={0} stroke={V.line} />
                <Tooltip cursor={false} content={({ active, payload }) => active && payload?.length ? <TipCard title={`t = ${payload[0].payload.t}`} rows={[{ label: "Order flow", value: (payload[0].payload[p.key] as number).toFixed(3) }, { label: "Same-day return", value: `${((payload[0].payload.ret as number) * 100).toFixed(2)}%` }]} /> : null} />
                <Scatter data={revision} fill={p.color} stroke={V.panel} strokeWidth={1.5} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </figure>
      ))}
      <p className="text-xs text-fg-muted md:col-span-2">
        Historical correlation (t30–800): <span className="num text-fg">{summary.corr_history > 0 ? "+" : ""}{summary.corr_history.toFixed(2)}</span>. The Round 1 window had the opposite sign; our label-free integrity check now flags that pattern before any submission.
      </p>
    </div>
  );
}

export function ShiftExplorer({ hist, table }: {
  hist: Record<string, { edges: number[]; ref: number[]; cur: number[] }>;
  table: { feature: string; ref_mean: number; cur_mean: number; std_ratio: number; mean_shift_in_ref_sd: number; ks_stat: number }[];
}) {
  const keys = Object.keys(hist);
  const [k, setK] = useState(keys[0]);
  const h = hist[k];
  // note: never name a datum key "ref" — Recharts spreads entries onto elements and React treats it as a ref
  const data = h.ref.map((r, i) => ({ x: (h.edges[i] + h.edges[i + 1]) / 2, history: r * 100, hidden: h.cur[i] * 100 }));
  const row = table.find((t) => t.feature === k);
  const fmt = (v: number) => (Math.abs(v) < 0.1 ? v.toFixed(3) : v.toFixed(2));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Feature" size="sm" value={k} onChange={setK} options={keys.map((x) => ({ value: x, label: x }))} />
        {row && (
          <span className="num text-xs text-fg-muted">
            shift {row.mean_shift_in_ref_sd > 0 ? "+" : ""}{row.mean_shift_in_ref_sd.toFixed(2)} sd · sd ratio {row.std_ratio.toFixed(2)}× · KS {row.ks_stat.toFixed(2)}
          </span>
        )}
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="18%">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="x" {...axis} tickFormatter={fmt} minTickGap={24} />
            <YAxis {...axis} width={40} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <Tooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`${k} ≈ ${fmt(payload[0].payload.x)}`} rows={[{ color: V.original, label: "Rows 1–800", value: `${(payload[0].payload.history as number).toFixed(1)}%` }, { color: V.ridge, label: "Hidden window 851–900", value: `${(payload[0].payload.hidden as number).toFixed(1)}%` }]} /> : null} />
            <Bar dataKey="history" fill={V.original} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="hidden" fill={V.ridge} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-5">
        <LegendItem color={V.original} label="Rows 1–800 (share of rows)" />
        <LegendItem color={V.ridge} label="Hidden window 851–900" />
      </div>
    </div>
  );
}
