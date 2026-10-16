import type { Metadata } from "next";
import { getBacktest } from "@/lib/data";
import { Note, PageHero, Panel } from "@/components/ui/primitives";
import BacktestExplorer from "@/components/charts/BacktestExplorer";

export const metadata: Metadata = { title: "Strategy backtesting" };

export default function BacktestPage() {
  const bt = getBacktest();
  const s = bt.significance;
  return (
    <>
      <PageHero
        n={5}
        kicker="Strategy backtesting"
        title="Hypothetical,"
        accent="and honest about it."
        meta={`${bt.days.length} out-of-sample days · t${bt.days[0].t}–${bt.days[bt.days.length - 1].t}`}
        lede={<>Positions come from models trained only on earlier rows. Returns are the realised next-day returns the organisers released. P&L = position × return − cost × |Δposition|, with costs you choose. No backtest exists for 851–900, because its returns are hidden.</>}
      />
      <BacktestExplorer days={bt.days} meta={bt.strategies} costs={bt.costsBps} />
      <Panel className="mt-6" kicker="Multiple testing" title="Is any of this significant?">
        <p className="max-w-3xl text-sm leading-relaxed text-fg-muted">
          Ridge beats the original on every cost level, but a paired block bootstrap gives p ≈ <span className="num text-fg">{s.ridge_vs_baseline_p.toFixed(2)}</span>. The selective
          strategy against ridge gives p ≈ <span className="num text-fg">{s.selective_vs_ridge_p.toFixed(2)}</span>. With about {s.candidates_tested} candidates tested, the corrected bar is{" "}
          <span className="num text-fg">{s.bar.toFixed(4)}</span>. No challenger clears it, so the differences above are consistent with noise.
        </p>
      </Panel>
      <Note>Each figure is recomputed in the browser from position and return arrays; the build verifies it against the Python engine (mean block Sharpe matches to 1e-6).</Note>
    </>
  );
}
