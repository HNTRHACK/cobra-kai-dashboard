"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, XCircle } from "lucide-react";
import { Segmented, Stat } from "@/components/ui/interactive";
import { DirectionChip, KeyValue, Panel, Provenance, cx } from "@/components/ui/primitives";
import type { SignalStats } from "@/lib/metrics";
import { direction, fixed } from "@/lib/format";
import { TipCard, axis } from "./kit";
import { V } from "./useThemeColors";

type SignalFileView = {
  key: string; label: string; file: string;
  signals: { t: number; s: number }[];
  stats: SignalStats;
  validation: { ok: boolean; checks: { label: string; pass: boolean }[] };
};
type WindowRow = { t: number; vol: number; crash: number; p: number; regime: string };

const COLOR: Record<string, string> = { v2: V.v2, original: V.original, ridge: V.ridge };

export default function SignalExplorer({ files, window }: { files: SignalFileView[]; window: WindowRow[] }) {
  const [key, setKey] = useState(files[0].key);
  const [sel, setSel] = useState<number>(files[0].signals.find((x) => x.s !== 0)?.t ?? 851);
  const [filter, setFilter] = useState<"all" | "long" | "short" | "flat">("all");
  const f = files.find((x) => x.key === key)!;
  const win = useMemo(() => new Map(window.map((w) => [w.t, w])), [window]);
  // Confidence is only defined for the original file, whose signal was generated from the ensemble's P(UP).
  const conf = (t: number) => (key === "original" ? Math.max(win.get(t)!.p, 1 - win.get(t)!.p) : null);
  const rows = f.signals.filter((x) => filter === "all" || (filter === "long" ? x.s > 0 : filter === "short" ? x.s < 0 : x.s === 0));
  const selRow = f.signals.find((x) => x.t === sel)!;
  const selWin = win.get(sel)!;
  const prev = f.signals.find((x) => x.t === sel - 1)?.s ?? 0;
  const maxAbs = Math.max(...files.flatMap((x) => x.signals.map((s) => Math.abs(s.s))), 0.01);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmented label="Signal file" value={key} onChange={(k) => setKey(k)} options={files.map((x) => ({ value: x.key, label: x.label }))} />
        <span className="num text-xs text-fg-muted">{f.file}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Long" value={f.stats.long} fmt={{ decimals: 0 }} sub="positions > 0" tag={<Provenance kind="submitted" />} />
        <Stat label="Short" value={f.stats.short} fmt={{ decimals: 0 }} sub="positions < 0" />
        <Stat label="Flat" value={f.stats.flat} fmt={{ decimals: 0 }} sub="positions = 0" />
        <Stat label="Avg exposure" value={f.stats.avgExposure} fmt={{ decimals: 3 }} sub={`net ${fixed(f.stats.netExposure, 3, true)}`} accent />
        <Stat label="Turnover" value={f.stats.totalTurnover} fmt={{ decimals: 2 }} sub={`${f.stats.avgTurnover.toFixed(3)} per day · incl. entry`} />
      </div>

      <Panel kicker="Positions, 851–900" title="Position path" tag={<Provenance kind="submitted" />}>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={f.signals} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2} onClick={(e) => { const t = Number(e?.activeLabel); if (Number.isFinite(t)) setSel(t); }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" {...axis} minTickGap={24} />
              <YAxis {...axis} width={44} domain={[-maxAbs, maxAbs]} ticks={[-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs]} tickFormatter={(v) => v.toFixed(2)} />
              <ReferenceLine y={0} stroke={V.line} />
              <Tooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? <TipCard title={`t = ${payload[0].payload.t}`} rows={[{ color: (payload[0].payload.s as number) > 0 ? V.long : (payload[0].payload.s as number) < 0 ? V.short : V.flat, label: direction(payload[0].payload.s as number), value: (payload[0].payload.s as number).toFixed(4) }, { label: "Regime", value: win.get(payload[0].payload.t)?.regime ?? "—" }]} /> : null} />
              <Bar dataKey="s" radius={[3, 3, 3, 3]} isAnimationActive={false} className="cursor-pointer">
                {f.signals.map((x) => (
                  <Cell key={x.t} fill={x.s > 0 ? V.long : x.s < 0 ? V.short : V.flat} fillOpacity={x.t === sel ? 1 : 0.78} stroke={x.t === sel ? V.fg : "none"} strokeWidth={x.t === sel ? 1.5 : 0} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-fg-muted">Gaps are flat days. Click a bar to inspect it below.</p>
      </Panel>

      <Panel kicker="All files, same scale" title="Strategy comparison">
        <div className="space-y-3">
          {files.map((x) => (
            <div key={x.key} className="grid grid-cols-[8.5rem_1fr] items-center gap-3 sm:grid-cols-[11rem_1fr]">
              <span className="flex items-center gap-2 text-sm">
                <span aria-hidden className="size-2 rounded-full" style={{ background: COLOR[x.key] }} />
                <span className={cx(x.key === key ? "font-semibold" : "text-fg-muted")}>{x.label}</span>
              </span>
              <div className="flex h-9 items-center gap-[2px]" role="img" aria-label={`${x.label}: ${x.stats.long} long, ${x.stats.short} short, ${x.stats.flat} flat`}>
                {x.signals.map((s) => (
                  <span
                    key={s.t}
                    title={`t ${s.t}: ${s.s.toFixed(3)}`}
                    className="flex-1 rounded-[2px]"
                    style={{
                      height: `${12 + (Math.abs(s.s) / maxAbs) * 88}%`,
                      background: s.s > 0 ? V.long : s.s < 0 ? V.short : "color-mix(in oklab, var(--flat) 35%, transparent)",
                      opacity: s.s === 0 ? 1 : 0.35 + 0.65 * (Math.abs(s.s) / maxAbs),
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-fg-muted">Bar height and opacity scale with |signal|. Counts above are recomputed from each CSV at build time, not typed in.</p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-8" kicker="Signal table" title="Inspect individual signals" actions={
          <Segmented label="Filter direction" size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "long", label: "Long" }, { value: "short", label: "Short" }, { value: "flat", label: "Flat" }]} />
        }>
          <div className="max-h-[520px] overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[620px] text-sm">
              <caption className="sr-only">Signals for {f.label}; select a row to inspect it</caption>
              <thead className="sticky top-0 z-10 bg-panel text-left">
                <tr className="border-b border-line text-xs text-fg-muted">
                  {["Timestamp", "Direction", "Position size", "Confidence", "Volatility", "Regime"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const w = win.get(x.t)!;
                  const c = conf(x.t);
                  const isSel = x.t === sel;
                  return (
                    <tr
                      key={x.t}
                      tabIndex={0}
                      aria-selected={isSel}
                      onClick={() => setSel(x.t)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(x.t))}
                      className={cx("cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-fg/[0.04] focus-visible:bg-fg/[0.06]", isSel && "bg-fg/[0.07]")}
                    >
                      <td className="num px-3 py-2.5">{x.t}</td>
                      <td className="px-3 py-2"><DirectionChip s={x.s} size="sm" /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="num w-14 text-right">{x.s.toFixed(3)}</span>
                          <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-fg/10" aria-hidden>
                            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(Math.abs(x.s) / maxAbs) * 100}%`, background: x.s > 0 ? V.long : x.s < 0 ? V.short : V.flat }} />
                          </span>
                        </div>
                      </td>
                      <td className="num px-3 py-2.5 text-fg-muted">{c == null ? "Not available" : c.toFixed(3)}</td>
                      <td className="num px-3 py-2.5">{(w.vol * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span aria-hidden className="size-1.5 rounded-full" style={{ background: w.regime === "crash" ? V.crash : w.regime === "elevated" ? V.elevated : V.muted }} />
                          {w.regime}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6 lg:col-span-4">
          <Panel kicker={`Selected · t = ${sel}`} title={<span className="flex items-center gap-3">Signal detail <DirectionChip s={selRow.s} /></span>}>
            <dl>
              <KeyValue k="Position" v={selRow.s.toFixed(4)} />
              <KeyValue k="Change vs t−1" v={fixed(selRow.s - prev, 4, true)} />
              <KeyValue k="Trade cost @10 bps" v={`${(Math.abs(selRow.s - prev) * 10).toFixed(2)} bps of capital`} />
              <KeyValue k="σ20 volatility" v={`${(selWin.vol * 100).toFixed(2)}%`} />
              <KeyValue k="Crash flag" v={selWin.crash ? "on" : "off"} />
              <KeyValue k="Confidence" v={conf(sel) == null ? "Not available" : conf(sel)!.toFixed(3)} />
              {key === "original" && <KeyValue k="Ensemble P(UP)" v={selWin.p.toFixed(3)} />}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-fg-muted">
              Outcome for this timestamp is not shown: closing prices for 851–900 are withheld by the organisers and are never reconstructed here.
            </p>
          </Panel>
          <Panel kicker="Format validation" title={<span className="flex items-center gap-2">{f.validation.ok ? <CheckCircle2 className="size-5 text-long" aria-hidden /> : <XCircle className="size-5 text-short" aria-hidden />}{f.validation.ok ? "PASS" : "FAIL"}</span>}>
            <ul className="space-y-2 text-sm">
              {f.validation.checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.pass ? <CheckCircle2 className="size-4 shrink-0 text-long" aria-hidden /> : <XCircle className="size-4 shrink-0 text-short" aria-hidden />}
                  <span>{c.label}</span>
                  <span className="sr-only">{c.pass ? "pass" : "fail"}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
