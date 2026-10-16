import type { Metadata } from "next";
import { getMarket, getRegimes, getSignalFiles, getWindow } from "@/lib/data";
import { pct } from "@/lib/format";
import { Note, PageHero, Panel, Provenance, SectionHead } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/interactive";
import { OrderFlowRevision, RegimeStrip, RsiChart, ShiftExplorer, VolRegimeChart, VolumeShockChart } from "@/components/charts/MarketCharts";

export const metadata: Metadata = { title: "Market regime analytics" };

export default function RegimesPage() {
  const market = getMarket();
  const reg = getRegimes();
  const win = getWindow();
  const original = getSignalFiles().find((f) => f.key === "original")!;
  const rows = market.rows.map((r) => ({ t: r.t, vol: r.vol, crash: r.crash, regime: r.regime, vz: r.vz, rsi: r.rsi }));
  const f = reg.facts;
  const crashLatest = win[win.length - 1];
  const meanP = win.reduce((a, w) => a + w.p, 0) / win.length;
  const upCalls = win.filter((w) => w.p > 0.5).length;
  const shiftRows = [...reg.shift.table].sort((a, b) => Math.abs(b.mean_shift_in_ref_sd) - Math.abs(a.mean_shift_in_ref_sd));

  return (
    <>
      <PageHero
        n={3}
        kicker="Market regime analytics"
        title="When the market"
        accent="leaves the map."
        meta="permitted columns only"
        lede={<>Rows 851–900 sit outside anything in the training history. The open price falls {pct(f.open_min_hidden / f.open_first_hidden - 1, 1)} and mean volatility reaches {(f.vol_mean_hidden * 100).toFixed(2)}%, above the labeled maximum of {(f.vol_max_labeled * 100).toFixed(2)}%.</>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Crash detector" value={f.crash_rows_hidden} fmt={{ decimals: 0, suffix: " / 50" }} sub={`rows flagged · latest t${crashLatest.t}: ${crashLatest.crash ? "ON" : "off"}`} tag={<Provenance kind="submitted" />} accent />
        <Stat label="Hidden-window σ20" value={f.vol_mean_hidden * 100} fmt={{ decimals: 2, suffix: "%" }} sub={`labeled max ${(f.vol_max_labeled * 100).toFixed(2)}%`} />
        <Stat label="Open-price drawdown" value={(f.open_min_hidden / f.open_first_hidden - 1) * 100} fmt={{ decimals: 1, suffix: "%" }} sub={`${f.open_first_hidden.toFixed(2)} → ${f.open_min_hidden.toFixed(2)}`} />
        <Stat label="Lag-1 return autocorr" value={f.lag1_autocorr} fmt={{ decimals: 3 }} sub="labeled history: short-term mean reversion" tag={<Provenance kind="historical" />} />
      </div>

      <section className="mt-20 space-y-8">
        <SectionHead n={1} kicker="Volatility" title="Normal, elevated," accent="crash." aside="Regimes are computed causally from trailing windows: volatility z-score against the past 250 rows, 20-day open drawdown in volatility units, and the high–low range shock." />
        <Panel kicker="σ20 with regime shading" title="Volatility time series">
          <VolRegimeChart rows={rows} labeledThrough={market.labeledThrough} height={320} />
        </Panel>
        <Panel kicker="All 900 timestamps" title="Market regime timeline">
          <RegimeStrip rows={rows} />
        </Panel>
      </section>

      <section className="mt-20 space-y-8">
        <SectionHead n={2} kicker="Microstructure" title="Volume, order flow" accent="and momentum." />
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel kicker="Last 250 rows · |z| > 2 highlighted" title="Volume shock">
            <VolumeShockChart rows={rows} />
          </Panel>
          <Panel kicker="Last 250 rows · 30 / 70 bands" title="RSI analysis">
            <RsiChart rows={rows} />
          </Panel>
        </div>
        <Panel kicker="Round 1 window (801–850)" title="Order-flow analysis: a sign inversion caught">
          <OrderFlowRevision revision={reg.revision} summary={reg.revisionSummary} />
        </Panel>
      </section>

      <section className="mt-20 space-y-8">
        <SectionHead n={3} kicker="Distribution shift" title="Rows 1–800 versus" accent="the hidden window." aside="Kolmogorov–Smirnov statistic and mean shift in reference standard deviations, on permitted features only." />
        <div className="grid gap-6 xl:grid-cols-12">
          <Panel className="xl:col-span-7" kicker="Share of rows per bin" title="Feature distribution comparison">
            <ShiftExplorer hist={reg.shift.hist} table={reg.shift.table} />
          </Panel>
          <Panel className="xl:col-span-5" kicker="Ranked by |mean shift|" title="Drift table">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-fg-muted">
                    {["Feature", "Shift (sd)", "SD ratio", "KS"].map((h) => <th key={h} scope="col" className="py-2.5 pr-3 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {shiftRows.map((r) => (
                    <tr key={r.feature} className="border-b border-line last:border-b-0">
                      <th scope="row" className="num py-2.5 pr-3 text-left font-normal">{r.feature}</th>
                      <td className="num py-2.5 pr-3">{r.mean_shift_in_ref_sd > 0 ? "+" : ""}{r.mean_shift_in_ref_sd.toFixed(2)}</td>
                      <td className="num py-2.5 pr-3">{r.std_ratio.toFixed(2)}×</td>
                      <td className="num py-2.5 pr-3">{r.ks_stat.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>

      <section className="mt-20 space-y-8">
        <SectionHead n={4} kicker="Model response" title="How the models react" accent="to the crash." />
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel kicker="Learned pattern" title="Mean reversion is real">
            <p className="text-sm leading-relaxed text-fg-muted">
              In labeled history, today&apos;s return predicts tomorrow&apos;s with the opposite sign (lag-1 correlation {f.lag1_autocorr.toFixed(3)}), and the effect is
              stronger on high-volatility days. Every model family picked this up.
            </p>
          </Panel>
          <Panel kicker="Extrapolation" title="So they lean long after a fall">
            <p className="text-sm leading-relaxed text-fg-muted">
              In 851–900 the ensemble&apos;s mean P(UP) is <span className="num text-fg">{meanP.toFixed(3)}</span>, with {upCalls} of 50 rows above 0.5. The original trading file is{" "}
              <span className="num text-fg">{original.stats.long}</span> long / <span className="num text-fg">{original.stats.short}</span> short.
            </p>
          </Panel>
          <Panel kicker="Safeguards" title="Risk, not bravado">
            <p className="text-sm leading-relaxed text-fg-muted">
              Volatility targeting shrinks positions as σ20 rises, smoothing limits turnover, and no model is retrained inside the window, because its outcomes are hidden.
              Whether the crash continued or rebounded is unknown here.
            </p>
          </Panel>
        </div>
        <Note>No hidden closing prices, returns or labels are reconstructed. sma_10, sma_30 and momentum_5 are excluded from features and from this dashboard&apos;s data.</Note>
      </section>
    </>
  );
}
