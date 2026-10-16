"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, ErrorBar, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import { Segmented } from "@/components/ui/interactive";
import { LegendItem } from "@/components/ui/primitives";
import { histogram } from "@/lib/metrics";
import { TipCard, axis } from "./kit";
import { V } from "./useThemeColors";

export const FAMILY_LABEL: Record<string, string> = {
  logreg: "Logistic Regression",
  rf: "Random Forest",
  lightgbm: "LightGBM",
  histgb: "HistGradientBoosting",
  ridge: "Ridge Return Regression",
  catboost: "CatBoost",
  xgboost: "XGBoost",
  extratrees: "Extra Trees",
  dummy: "Majority baseline",
};

/** Mean MCC across outer blocks with ±1 sd, best config per family. Single measure → one colour. */
export function ModelMccBars({ rows }: { rows: { family: string; mcc_mean: number; mcc_std: number; ba_mean: number }[] }) {
  const data = rows.map((r) => ({ name: FAMILY_LABEL[r.family] ?? r.family, mcc: r.mcc_mean, err: r.mcc_std, ba: r.ba_mean, family: r.family }));
  return (
    <div style={{ height: Math.max(220, data.length * 44) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} />
          <XAxis type="number" {...axis} domain={[-0.05, 0.35]} tickFormatter={(v) => v.toFixed(2)} />
          <YAxis type="category" dataKey="name" {...axis} width={150} tick={{ fontSize: 12 }} />
          <ReferenceLine x={0} stroke={V.line} />
          <Tooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={payload[0].payload.name} rows={[{ color: V.accent, label: "MCC mean", value: (payload[0].payload.mcc as number).toFixed(3) }, { label: "± sd across blocks", value: (payload[0].payload.err as number).toFixed(3) }, { label: "Balanced accuracy", value: (payload[0].payload.ba as number).toFixed(3) }]} /> : null} />
          <Bar dataKey="mcc" fill={V.accent} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <ErrorBar dataKey="err" width={6} strokeWidth={1.5} stroke={V.muted} direction="x" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Walk-forward MCC per outer block; one focused family highlighted, the rest recessive. */
export function PerBlockFocus({ rows, families }: { rows: { family: string; val_block: string; mcc: number }[]; families: string[] }) {
  const [focus, setFocus] = useState(families.includes("ridge") ? "ridge" : families[0]);
  const blocks = [...new Set(rows.map((r) => r.val_block))].sort((a, b) => parseInt(a) - parseInt(b));
  const data = blocks.map((b) => {
    const o: Record<string, number | string> = { block: b };
    for (const f of families) {
      const r = rows.find((x) => x.family === f && x.val_block === b);
      if (r) o[f] = r.mcc;
    }
    return o;
  });
  return (
    <div>
      <div className="mb-4">
        <Segmented label="Highlight model" size="sm" value={focus} onChange={setFocus} options={families.map((f) => ({ value: f, label: FAMILY_LABEL[f] ?? f }))} />
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="block" {...axis} />
            <YAxis {...axis} width={44} tickFormatter={(v) => v.toFixed(2)} />
            <ReferenceLine y={0} stroke={V.line} />
            <Tooltip cursor={{ stroke: V.muted, strokeDasharray: "3 3" }} content={({ active, payload, label }) => active && payload?.length ? <TipCard title={`Block ${label}`} rows={families.filter((f) => payload[0].payload[f] != null).map((f) => ({ color: f === focus ? V.accent : V.muted, label: FAMILY_LABEL[f] ?? f, value: (payload[0].payload[f] as number).toFixed(3) }))} /> : null} />
            {families.filter((f) => f !== focus).map((f) => (
              <Line key={f} dataKey={f} stroke={V.muted} strokeOpacity={0.35} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            ))}
            <Line dataKey={focus} stroke={V.accent} strokeWidth={2.5} dot={{ r: 4, fill: V.accent, stroke: V.panel, strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-5">
        <LegendItem color={V.accent} label={FAMILY_LABEL[focus] ?? focus} />
        <LegendItem color={V.muted} label="Other families" />
      </div>
    </div>
  );
}

export function FeatureImportanceBars({ rows }: { rows: { feature: string; drop: number }[] }) {
  return (
    <div style={{ height: rows.length * 28 + 20 }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} />
          <XAxis type="number" {...axis} tickFormatter={(v) => v.toFixed(3)} />
          <YAxis type="category" dataKey="feature" {...axis} width={120} tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={payload[0].payload.feature} rows={[{ color: V.ridge, label: "OOS permutation AUC drop", value: (payload[0].value as number).toFixed(4) }]} /> : null} />
          <Bar dataKey="drop" fill={V.ridge} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Confidence distribution of OOS P(UP), split by the realised next-day direction. */
export function ConfidenceHistogram({ oos }: { oos: { p: number; y: number | null }[] }) {
  const data = useMemo(() => {
    const up = histogram(oos.filter((o) => o.y === 1).map((o) => o.p), 14, 0.15, 0.85);
    const dn = histogram(oos.filter((o) => o.y === 0).map((o) => o.p), 14, 0.15, 0.85);
    return up.map((b, i) => ({ x: (b.x0 + b.x1) / 2, up: b.count, down: dn[i].count }));
  }, [oos]);
  return (
    <div>
      <div className="h-60">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="16%">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="x" {...axis} tickFormatter={(v) => v.toFixed(2)} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...axis} width={36} allowDecimals={false} />
            <ReferenceLine x={0.5} stroke={V.muted} strokeDasharray="3 4" />
            <Tooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`P(UP) ≈ ${(payload[0].payload.x as number).toFixed(2)}`} rows={[{ color: V.long, label: "Next day UP", value: payload[0].payload.up }, { color: V.short, label: "Next day DOWN", value: payload[0].payload.down }]} /> : null} />
            <Bar dataKey="up" fill={V.long} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="down" fill={V.short} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-5">
        <LegendItem color={V.long} label="Realised UP" />
        <LegendItem color={V.short} label="Realised DOWN" />
      </div>
    </div>
  );
}

/** Prediction history: OOS P(UP) through time with realised outcomes as ticks. */
export function PredictionHistory({ oos }: { oos: { t: number; p: number; y: number | null }[] }) {
  const data = oos.map((o) => ({ t: o.t, p: o.p, up: o.y === 1 ? 0.97 : null, down: o.y === 0 ? 0.03 : null }));
  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} {...axis} minTickGap={36} />
            <YAxis {...axis} width={40} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} />
            <ReferenceLine y={0.5} stroke={V.muted} strokeDasharray="3 4" />
            <Tooltip cursor={{ stroke: V.muted, strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`t = ${payload[0].payload.t}`} rows={[{ color: V.accent, label: "P(UP), out-of-sample", value: (payload[0].payload.p as number).toFixed(3) }, { label: "Realised", value: payload[0].payload.up != null ? "UP" : payload[0].payload.down != null ? "DOWN" : "—" }]} /> : null} />
            <Scatter dataKey="up" fill={V.long} shape={(props: { cx?: number; cy?: number; fill?: string }) => <circle cx={props.cx} cy={props.cy} r={2.5} fill={props.fill} />} isAnimationActive={false} legendType="none" />
            <Scatter dataKey="down" fill={V.short} shape={(props: { cx?: number; cy?: number; fill?: string }) => <circle cx={props.cx} cy={props.cy} r={2.5} fill={props.fill} />} isAnimationActive={false} legendType="none" />
            <Line dataKey="p" stroke={V.accent} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, stroke: V.panel, strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-5">
        <LegendItem color={V.accent} label="Ensemble P(UP)" />
        <LegendItem color={V.long} label="Realised UP (top)" />
        <LegendItem color={V.short} label="Realised DOWN (bottom)" />
      </div>
    </div>
  );
}
