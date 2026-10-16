import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getBacktest, getCompetition, getMarket, getModels, getSignalFiles } from "@/lib/data";
import { runStrategy } from "@/lib/metrics";
import { pct, pad2 } from "@/lib/format";
import { Kicker, Panel, Provenance, SectionHead } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/interactive";
import { Ticker } from "@/components/chrome/Footer";
import { MarketChartLazy } from "@/components/charts/kit";
import { RegimeStrip, VolRegimeChart } from "@/components/charts/MarketCharts";
import { NAV } from "@/lib/nav";

export default function Overview() {
  const market = getMarket();
  const models = getModels();
  const bt = getBacktest();
  const files = getSignalFiles();
  const comp = getCompetition();
  const v2 = files.find((f) => f.key === "v2")!;
  const base = runStrategy(bt.days, "baseline", 10);
  const ridge = runStrategy(bt.days, "ridge", 10);
  const hidden = market.rows.filter((r) => r.t >= market.hiddenFrom);
  const crashRows = hidden.filter((r) => r.crash === 1).length;
  const minOpen = Math.min(...hidden.map((r) => r.o));
  const latest = comp.standings[comp.standings.length - 1];
  const regimeRows = market.rows.map((r) => ({ t: r.t, vol: r.vol, crash: r.crash, regime: r.regime, vz: r.vz, rsi: r.rsi }));

  const status = [
    { k: "Active asset", v: market.asset },
    { k: "Market regime", v: `Flash crash · ${crashRows}/${hidden.length} rows flagged`, dot: "var(--crash)" },
    { k: "Competition", v: `Round 3 · rank ${latest.rank}${latest.of ? ` of ${latest.of}` : ""} (reported)` },
    { k: "Current strategy", v: "V2 · latest upload" },
    { k: "Model status", v: "Frozen at t850 · no in-window retraining" },
  ];

  return (
    <>
      {/* hero — UMANG dateline + giant display headline + heavy rule */}
      <section className="flex min-h-[min(88svh,980px)] flex-col justify-between pt-28 pb-10">
        <div className="fade-up flex flex-wrap items-baseline justify-between gap-3 text-xs text-fg-muted">
          <span className="num">(CK—01)</span>
          <span className="kicker">GLACIER_GAS · Edition R3</span>
          <span className="num">t = 1 → 900 · 50 hidden</span>
        </div>
        <div>
          <p className="kicker fade-up text-fg-muted" style={{ animationDelay: "60ms" }}>Quantitative Trading Intelligence</p>
          <h1 className="display fade-up mt-6 text-[clamp(3.2rem,11vw,11.5rem)]" style={{ animationDelay: "120ms" }}>
            Built for volatility.
            <br />
            <span className="serif-i pr-[0.08em] text-accent">Driven by intelligence.</span>
          </h1>
          <div className="mt-10 border-b-2 border-line-strong" />
          <div className="mt-8 grid gap-8 lg:grid-cols-12">
            <p className="max-w-xl text-lg leading-relaxed text-fg-muted lg:col-span-6">
              The full story of COBRA KAI&apos;s GLACIER_GAS campaign: market analysis, leakage-safe machine learning, a 27% flash crash outside
              anything in the training data, and the risk decisions that followed.
            </p>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:col-span-6">
              {status.map((s) => (
                <div key={s.k} className="border-b border-line pb-3">
                  <dt className="kicker text-fg-muted">{s.k}</dt>
                  <dd className="mt-1.5 flex items-center gap-2 text-sm font-medium">
                    {s.dot && <span aria-hidden className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: s.dot }} /><span className="relative size-2 rounded-full" style={{ background: s.dot }} /></span>}
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <Ticker
        items={[
          `BA ${models.oosSummary.ba.toFixed(3)} OOS`,
          `MCC ${models.oosSummary.mcc.toFixed(3)} OOS`,
          `Round 1 public ${comp.rounds[0].publicScore.toFixed(2)}`,
          `Round 2 public ${comp.rounds[1].publicScore.toFixed(2)}`,
          `Round 3 V2 public ${comp.rounds[2].publicScore.toFixed(2)}`,
          `Open low ${pct(minOpen / hidden[0].o - 1, 1)} in 851–900`,
          `σ20 peak ${(Math.max(...hidden.map((r) => r.vol)) * 100).toFixed(2)}%`,
          `${v2.stats.long} long · ${v2.stats.short} short · ${v2.stats.flat} flat`,
        ]}
      />

      <section className="mt-20 space-y-8" aria-labelledby="kpis">
        <SectionHead n={1} kicker="Key figures" title="Signal quality and" accent="risk, at a glance." aside="Every figure is tagged with its source: historical out-of-sample validation, the submitted file itself, or the public leaderboard." />
        <h2 id="kpis" className="sr-only">Key figures</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="Balanced accuracy" value={models.oosSummary.ba} fmt={{ decimals: 3 }} sub={`Ensemble, t${models.oosSummary.from}–${models.oosSummary.to}`} tag={<Provenance kind="historical" />} />
          <Stat label="MCC" value={models.oosSummary.mcc} fmt={{ decimals: 3 }} sub={`${models.oosSummary.n} out-of-sample days`} tag={<Provenance kind="historical" />} />
          <Stat label="Historical Sharpe" value={base.meanBlockSharpe} fmt={{ decimals: 2 }} sub={`Original @10 bps · Ridge ${ridge.meanBlockSharpe.toFixed(2)}`} tag={<Provenance kind="hypothetical" />} accent />
          <Stat label="Max drawdown" value={base.worstDrawdown * 100} fmt={{ decimals: 1, suffix: "%" }} sub="Worst 50-day block, original" tag={<Provenance kind="hypothetical" />} />
          <Stat label="Average exposure" value={v2.stats.avgExposure} fmt={{ decimals: 3 }} sub={`V2 file · ${v2.stats.flat} of ${v2.stats.n} days flat`} tag={<Provenance kind="submitted" />} />
          <Stat label="Trading turnover" value={v2.stats.totalTurnover} fmt={{ decimals: 2 }} sub={`V2 file · ${v2.stats.avgTurnover.toFixed(3)} per day`} tag={<Provenance kind="submitted" />} />
        </div>
      </section>

      <section className="mt-24 space-y-8">
        <SectionHead n={2} kicker="Market" title="GLACIER_GAS," accent="900 sessions." aside={<>Candles end at t{market.labeledThrough}. For 851–900 the organisers withheld the close, so only the open price is drawn (dashed). The open falls from {hidden[0].o.toFixed(2)} to a low of {minOpen.toFixed(2)}.</>} />
        <Panel kicker="Price · volume · volatility · organiser dataset" title="Interactive market chart">
          <MarketChartLazy
            rows={market.rows.map(({ t, o, h, l, c, v, vol, crash }) => ({ t, o, h, l, c, v, vol, crash }))}
            signalSets={files.filter((f) => f.key !== "ridge").map((f) => ({ key: f.key, label: f.key === "v2" ? "V2 signals" : "Original signals", signals: f.signals }))}
            labeledThrough={market.labeledThrough}
          />
        </Panel>
      </section>

      <section className="mt-24 space-y-8">
        <SectionHead n={3} kicker="Regime" title="From normal conditions" accent="to the flash crash." aside="Crash flag: trailing volatility z > 2, a 20-day drawdown beyond 2.5 volatility units, or a range shock above 2.5× — all computed from past rows only." />
        <div className="grid gap-6 lg:grid-cols-12">
          <Panel className="lg:col-span-8" kicker="σ20 volatility, regime shaded" title="Volatility regime transition">
            <VolRegimeChart rows={regimeRows} labeledThrough={market.labeledThrough} />
          </Panel>
          <Panel className="lg:col-span-4" kicker="900 timestamps" title="Regime timeline">
            <RegimeStrip rows={regimeRows} />
            <dl className="mt-6">
              {(["normal", "elevated", "crash"] as const).map((r) => (
                <div key={r} className="flex items-baseline justify-between border-b border-line py-2.5 last:border-b-0">
                  <dt className="text-sm capitalize text-fg-muted">{r}</dt>
                  <dd className="num text-sm">{regimeRows.filter((x) => x.regime === r).length}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </section>

      {/* UMANG "take action" pattern: large numbered option rows */}
      <section className="mt-28">
        <Kicker n={4}>Explore</Kicker>
        <nav aria-label="Dashboard sections" className="mt-6 border-t border-line-strong">
          {NAV.slice(1).map((n, i) => (
            <Link key={n.href} href={n.href} className="group grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-line py-6 transition-[padding] duration-500 ease-[var(--ease-expo)] hover:px-3 sm:grid-cols-[5rem_1fr_auto] sm:py-8">
              <span className="num text-sm text-fg-muted">{pad2(i + 2)}</span>
              <span className="display text-4xl transition-transform duration-500 group-hover:translate-x-2 sm:text-6xl">{n.label}</span>
              <span className="grid size-11 place-items-center rounded-full border border-fg transition-colors duration-300 group-hover:bg-fg group-hover:text-bg sm:size-14">
                <ArrowUpRight className="size-5" aria-hidden />
              </span>
            </Link>
          ))}
        </nav>
      </section>
    </>
  );
}
