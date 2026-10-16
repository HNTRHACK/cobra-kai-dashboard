"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Segmented, Stat, ToggleChip } from "@/components/ui/interactive";
import { LegendItem, Panel, Provenance, cx } from "@/components/ui/primitives";
import { histogram, runStrategy, type Day } from "@/lib/metrics";
import { pct } from "@/lib/format";
import { TipCard, axis } from "./kit";
import { V } from "./useThemeColors";

type Meta = Record<string, { name: string; short: string; desc: string }>;
const KEYS = ["baseline", "ridge", "selective"] as const;
type K = (typeof KEYS)[number];
const COLOR: Record<K, string> = { baseline: V.original, ridge: V.ridge, selective: V.selective };

export default function BacktestExplorer({ days, meta, costs }: { days: Day[]; meta: Meta; costs: number[] }) {
  const [cost, setCost] = useState(10);
  const [on, setOn] = useState<Record<K, boolean>>({ baseline: true, ridge: true, selective: true });
  const [focus, setFocus] = useState<K>("baseline");
  const visible = KEYS.filter((k) => on[k]);

  const res = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, runStrategy(days, k, cost)])) as Record<K, ReturnType<typeof runStrategy>>, [days, cost]);
  const sens = useMemo(() => costs.concat(30).map((c) => ({ cost: c, ...Object.fromEntries(KEYS.map((k) => [k, runStrategy(days, k, c).meanBlockSharpe])) })), [days, costs]);

  const curve = res.baseline.curve.map((p, i) => ({
    t: p.t,
    ...Object.fromEntries(KEYS.map((k) => [k, (res[k].curve[i].equity - 1) * 100])),
    ...Object.fromEntries(KEYS.map((k) => [`${k}_dd`, res[k].curve[i].drawdown * 100])),
  }));
  const blocks = res.baseline.blocks.map((b, i) => ({
    block: days.find((d) => d.block === b.block)!.t,
    ...Object.fromEntries(KEYS.map((k) => [k, res[k].blocks[i].totalReturn * 100])),
  }));
  const dist = useMemo(() => {
    const pnl = res[focus].curve.map((c) => c.pnl * 100);
    return histogram(pnl, 24, -3, 3).map((b) => ({ x: (b.x0 + b.x1) / 2, n: b.count }));
  }, [res, focus]);

  const tipRows = (p: Record<string, number>, suffix = "", dd = false) =>
    visible.map((k) => ({ color: COLOR[k], label: meta[k].short, value: `${(p[dd ? `${k}_dd` : k] as number).toFixed(2)}${suffix}` }));

  return (
    <div className="space-y-6">
      <div className="glass sticky top-20 z-30 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="kicker text-fg-muted">Cost</span>
          <Segmented label="Transaction cost (basis points)" value={cost} onChange={setCost} options={costs.map((c) => ({ value: c, label: `${c} bps` }))} />
        </div>
        <div className="flex flex-wrap gap-2">
          {KEYS.map((k) => (
            <ToggleChip key={k} on={on[k]} color={COLOR[k]} onClick={() => setOn((o) => ({ ...o, [k]: !o[k] || KEYS.filter((x) => o[x]).length === 1 }))}>
              {meta[k].short}
            </ToggleChip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {visible.slice(0, 3).map((k) => (
          <Stat
            key={k}
            label={`${meta[k].short} · Sharpe`}
            value={res[k].meanBlockSharpe}
            fmt={{ decimals: 2 }}
            sub={`mean of ${res[k].blocks.length} blocks · ${pct(res[k].meanBlockReturn)} / block`}
            tag={<Provenance kind="hypothetical" />}
          />
        ))}
        <div className="flex min-h-40 flex-col justify-between rounded-2xl border border-dashed border-line p-5">
          <p className="kicker text-fg-muted">V2 · historical</p>
          <div>
            <p className="text-lg text-fg-muted">Not available</p>
            <p className="mt-2 text-xs leading-relaxed text-fg-muted">V2&apos;s generating code is unavailable, so no historical backtest can be computed.</p>
            <div className="mt-3"><Provenance kind="unavailable" /></div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-8" kicker={`Chained equity · ${cost} bps`} title="Cumulative return" tag={<Provenance kind="hypothetical" />}>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} {...axis} minTickGap={36} />
                <YAxis {...axis} width={48} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <ReferenceLine y={0} stroke={V.line} />
                <Tooltip cursor={{ stroke: V.muted, strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`t = ${payload[0].payload.t}`} rows={tipRows(payload[0].payload, "%")} /> : null} />
                {visible.map((k) => (
                  <Line key={k} dataKey={k} stroke={COLOR[k]} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, stroke: V.panel, strokeWidth: 2 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-5">{visible.map((k) => <LegendItem key={k} color={COLOR[k]} label={meta[k].name} />)}</div>
          <p className="mt-3 text-xs text-fg-muted">Six 50-day out-of-sample blocks (t551–849) chained; each block re-enters from flat, as in validation.</p>
        </Panel>
        <Panel className="xl:col-span-4" kicker="Underwater" title="Drawdown">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} {...axis} minTickGap={36} />
                <YAxis {...axis} width={44} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                <Tooltip cursor={{ stroke: V.muted, strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`t = ${payload[0].payload.t}`} rows={tipRows(payload[0].payload, "%", true)} /> : null} />
                {visible.map((k) => (
                  <Area key={k} dataKey={`${k}_dd`} stroke={COLOR[k]} strokeWidth={1.5} fill={COLOR[k]} fillOpacity={0.08} isAnimationActive={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel kicker="Trading activity" title="Positions through time">
        <div className="space-y-3">
          {visible.map((k) => {
            const pos = res[k].curve;
            const max = Math.max(...pos.map((p) => Math.abs(p.pos)), 0.01);
            return (
              <div key={k} className="grid grid-cols-[6rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr]">
                <span className="flex items-center gap-2 text-sm"><span aria-hidden className="size-2 rounded-full" style={{ background: COLOR[k] }} />{meta[k].short}</span>
                <div className="flex h-8 items-center" role="img" aria-label={`${meta[k].name} positions over 299 days`}>
                  {pos.map((p) => (
                    <span key={p.t} className="h-full flex-1" title={`t ${p.t}: ${p.pos.toFixed(3)}`} style={{ background: p.pos > 0 ? V.long : p.pos < 0 ? V.short : "transparent", opacity: 0.15 + 0.85 * (Math.abs(p.pos) / max) }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-5">
          <LegendItem color={V.long} label="Long (opacity ∝ size)" />
          <LegendItem color={V.short} label="Short" />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel kicker="Per block" title="Block returns">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={blocks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="block" {...axis} tickFormatter={(v) => `t${v}`} />
                <YAxis {...axis} width={44} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                <ReferenceLine y={0} stroke={V.line} />
                <Tooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`Block from t${payload[0].payload.block}`} rows={tipRows(payload[0].payload, "%")} /> : null} />
                {visible.map((k) => <Bar key={k} dataKey={k} fill={COLOR[k]} radius={[3, 3, 3, 3]} isAnimationActive={false} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel kicker="Robustness" title="Transaction-cost sensitivity">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={sens} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="cost" {...axis} tickFormatter={(v) => `${v} bps`} />
                <YAxis {...axis} width={40} tickFormatter={(v) => v.toFixed(1)} />
                <ReferenceLine y={0} stroke={V.line} />
                <ReferenceLine x={cost} stroke={V.muted} strokeDasharray="3 4" />
                <Tooltip cursor={{ stroke: V.muted, strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`${payload[0].payload.cost} bps`} rows={visible.map((k) => ({ color: COLOR[k], label: `${meta[k].short} Sharpe`, value: (payload[0].payload[k] as number).toFixed(2) }))} /> : null} />
                {visible.map((k) => <Line key={k} dataKey={k} stroke={COLOR[k]} strokeWidth={2} dot={{ r: 3.5, fill: COLOR[k], stroke: V.panel, strokeWidth: 2 }} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel kicker="Daily P&L" title="Return distribution" actions={<Segmented label="Strategy" size="sm" value={focus} onChange={setFocus} options={KEYS.map((k) => ({ value: k, label: meta[k].short }))} />}>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={dist} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="x" {...axis} tickFormatter={(v) => `${v.toFixed(1)}%`} minTickGap={20} />
              <YAxis {...axis} width={36} allowDecimals={false} />
              <ReferenceLine x={0} stroke={V.muted} strokeDasharray="3 4" />
              <Tooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`daily P&L ≈ ${(payload[0].payload.x as number).toFixed(2)}%`} rows={[{ color: COLOR[focus], label: "Days", value: payload[0].payload.n }]} /> : null} />
              <Bar dataKey="n" fill={COLOR[focus]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-fg-muted">Flat days sit at 0%. Values clipped to ±3% for display.</p>
      </Panel>

      <Panel kicker={`Comparison · ${cost} bps`} title="Strategy table" tag={<Provenance kind="hypothetical" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-fg-muted">
                {["Strategy", "Mean block Sharpe", "Return / block", "Chained return", "Worst block", "Worst drawdown", "Turnover", "Exposure", "Positive blocks"].map((h) => (
                  <th key={h} scope="col" className="py-2.5 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KEYS.map((k) => {
                const r = res[k];
                return (
                  <tr key={k} className={cx("border-b border-line last:border-b-0", !on[k] && "opacity-50")}>
                    <th scope="row" className="py-3 pr-4 text-left font-medium">
                      <span className="flex items-center gap-2"><span aria-hidden className="size-2 rounded-full" style={{ background: COLOR[k] }} />{meta[k].name}</span>
                      <span className="mt-1 block max-w-xs text-xs font-normal text-fg-muted">{meta[k].desc}</span>
                    </th>
                    <td className="num py-3 pr-4">{r.meanBlockSharpe.toFixed(2)}</td>
                    <td className="num py-3 pr-4">{pct(r.meanBlockReturn)}</td>
                    <td className="num py-3 pr-4">{pct(r.chainedReturn)}</td>
                    <td className="num py-3 pr-4">{pct(r.worstBlockReturn)}</td>
                    <td className="num py-3 pr-4">{pct(r.worstDrawdown)}</td>
                    <td className="num py-3 pr-4">{r.avgTurnover.toFixed(3)}</td>
                    <td className="num py-3 pr-4">{r.avgExposure.toFixed(3)}</td>
                    <td className="num py-3 pr-4">{r.positiveBlocks}/{r.blocks.length}</td>
                  </tr>
                );
              })}
              <tr>
                <th scope="row" className="py-3 pr-4 text-left font-medium">
                  <span className="flex items-center gap-2"><span aria-hidden className="size-2 rounded-full border border-fg-muted" />V2 (active upload)</span>
                </th>
                <td colSpan={8} className="py-3 text-fg-muted">Not available — generating code unavailable; no historical performance is shown.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
