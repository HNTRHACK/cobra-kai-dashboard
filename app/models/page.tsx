import type { Metadata } from "next";
import { getModels, getPredictionFiles } from "@/lib/data";
import { KeyValue, Note, PageHero, Panel, Provenance, SectionHead, cx } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/interactive";
import { ConfidenceHistogram, FAMILY_LABEL, FeatureImportanceBars, ModelMccBars, PerBlockFocus, PredictionHistory } from "@/components/charts/ModelCharts";

export const metadata: Metadata = { title: "Machine learning intelligence" };

const REQUESTED = ["logreg", "rf", "lightgbm", "histgb", "ridge"];

function prettySelection(sel: string) {
  const ens = sel.match(/^ens_top(\d+)_equal$/);
  if (ens) return `Top-${ens[1]} equal-weight ensemble`;
  if (sel.startsWith("ens_")) return `Weighted ensemble (${sel.replace(/^ens_|_weighted$/g, "").split("_").map((x) => FAMILY_LABEL[x === "lgb" ? "lightgbm" : x === "cat" ? "catboost" : x === "lr" ? "logreg" : x] ?? x).join(", ")})`;
  const [fam, fs, params] = sel.split("|");
  return `${FAMILY_LABEL[fam] ?? fam} · ${fs}${params ? ` · ${params}` : ""}`;
}

export default function ModelsPage() {
  const m = getModels();
  const preds = getPredictionFiles();
  // best configuration per family (by mean MCC on outer blocks 501–800)
  const best = Object.values(
    m.models.reduce((acc, r) => {
      if (!acc[r.family] || r.mcc_mean > acc[r.family].mcc_mean) acc[r.family] = r;
      return acc;
    }, {} as Record<string, (typeof m.models)[number]>),
  ).filter((r) => r.family !== "dummy").sort((a, b) => b.mcc_mean - a.mcc_mean);
  const focusFamilies = REQUESTED.filter((f) => m.perBlock.some((r) => r.family === f));
  const minT = m.folds[0].train[0];
  const maxT = m.folds[m.folds.length - 1].val[1];
  const span = maxT - minT + 1;
  const r1 = m.round1Eval;
  const nested = m.nested.filter((n) => n.config.startsWith("NESTED|search_all_candidates") && n.selected);

  return (
    <>
      <PageHero
        n={2}
        kicker="Machine learning intelligence"
        title="Models that respect"
        accent="the arrow of time."
        meta={`${m.models.length} configurations · ${m.folds.length} walk-forward blocks`}
        lede={<>Every score below comes from expanding walk-forward validation: each 50-row block is predicted by a model trained only on earlier rows, with a one-row purge so no label that depends on the validation block leaks into training.</>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="OOS balanced accuracy" value={m.oosSummary.ba} fmt={{ decimals: 3 }} sub={`Final ensemble, t${m.oosSummary.from}–${m.oosSummary.to}`} tag={<Provenance kind="historical" />} />
        <Stat label="OOS MCC" value={m.oosSummary.mcc} fmt={{ decimals: 3 }} sub={`${m.oosSummary.n} days`} tag={<Provenance kind="historical" />} />
        <Stat label="Round 1 file · BA" value={r1.ba} fmt={{ decimals: 3 }} sub="vs labels released after Round 1" tag={<Provenance kind="submitted" />} accent />
        <Stat label="Round 1 file · MCC" value={r1.mcc} fmt={{ decimals: 3 }} sub={`${r1.n} predictions, t801–850`} tag={<Provenance kind="submitted" />} />
      </div>

      <section className="mt-20 space-y-8">
        <SectionHead n={1} kicker="Model comparison" title="Five families," accent="one protocol." aside="Best configuration per family on outer blocks 501–800, threshold 0.5. The maximum over many rows is optimistic, which is why selection was nested." />
        <div className="grid gap-6 xl:grid-cols-12">
          <Panel className="xl:col-span-5" kicker="Mean MCC ± 1 sd across blocks" title="Matthews correlation by family" tag={<Provenance kind="historical" />}>
            <ModelMccBars rows={best} />
          </Panel>
          <Panel className="xl:col-span-7" kicker="Best configuration per family" title="Comparison table">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-fg-muted">
                    {["Model", "Balanced acc.", "MCC", "AUC", "Brier", "Blocks MCC>0"].map((h) => (
                      <th key={h} scope="col" className="py-2.5 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {best.map((r) => (
                    <tr key={r.config} className={cx("border-b border-line last:border-b-0", REQUESTED.includes(r.family) ? "" : "text-fg-muted")}>
                      <th scope="row" className="py-3 pr-4 text-left font-medium">
                        {FAMILY_LABEL[r.family] ?? r.family}
                        <span className="num mt-0.5 block max-w-[16rem] truncate text-[11px] font-normal text-fg-muted" title={r.config}>{r.config.split("|").slice(1).join(" · ")}</span>
                      </th>
                      <td className="num py-3 pr-4">{r.ba_mean.toFixed(3)} <span className="text-fg-muted">±{r.ba_std.toFixed(3)}</span></td>
                      <td className="num py-3 pr-4">{r.mcc_mean.toFixed(3)} <span className="text-fg-muted">±{r.mcc_std.toFixed(3)}</span></td>
                      <td className="num py-3 pr-4">{r.auc_mean == null ? "—" : r.auc_mean.toFixed(3)}</td>
                      <td className="num py-3 pr-4">{r.brier_mean == null ? "—" : r.brier_mean.toFixed(4)}</td>
                      <td className="num py-3 pr-4">{r.folds_mcc_pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>Ridge is a return regression; its direction is scored by sign(prediction), so AUC and Brier do not apply. Muted rows were tested but are not in the core five.</Note>
          </Panel>
        </div>
      </section>

      <section className="mt-20 space-y-8">
        <SectionHead n={2} kicker="Walk-forward validation" title="Chronological splits," accent="no peeking." />
        <Panel kicker="Expanding window · 1-row purge" title="Train / purge / validate, block by block">
          <div className="space-y-1.5" role="list" aria-label="Walk-forward folds">
            {m.folds.map((f) => (
              <div key={f.k} role="listitem" className="grid grid-cols-[4.5rem_1fr] items-center gap-3 sm:grid-cols-[6rem_1fr]">
                <span className="num text-xs text-fg-muted">t{f.val[0]}–{f.val[1]}</span>
                <div className="relative h-5 rounded-md">
                  <span className="absolute inset-y-0 rounded-l-md bg-fg/15" style={{ left: 0, width: `${((f.train[1] - minT + 1) / span) * 100}%` }} title={`Train t${f.train[0]}–${f.train[1]}`} />
                  <span className="absolute inset-y-0 w-[3px] bg-fg-muted" style={{ left: `${((f.purge - minT) / span) * 100}%` }} title={`Purged row t${f.purge}`} />
                  <span className="absolute inset-y-0 rounded-r-md bg-accent-fill" style={{ left: `${((f.val[0] - minT) / span) * 100}%`, width: `${((f.val[1] - f.val[0] + 1) / span) * 100}%` }} title={`Validate t${f.val[0]}–${f.val[1]}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-5 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-5 rounded-sm bg-fg/15" />Training rows</span>
            <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-[3px] bg-fg-muted" />Purged row</span>
            <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-5 rounded-sm bg-accent-fill" />Validation block</span>
          </div>
          <Note>Features at row t use rows ≤ t only (verified by a truncation test). Scalers and imputers are fit inside each training window.</Note>
        </Panel>
        <div className="grid gap-6 xl:grid-cols-12">
          <Panel className="xl:col-span-7" kicker="Outer blocks 501–800" title="MCC per validation block" tag={<Provenance kind="historical" />}>
            <PerBlockFocus rows={m.perBlock} families={focusFamilies} />
          </Panel>
          <Panel className="xl:col-span-5" kicker="Nested selection" title="Model-selection timeline">
            <ol className="relative space-y-5 border-l border-line pl-5">
              {nested.map((n) => (
                <li key={n.val_block} className="relative">
                  <span aria-hidden className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-panel bg-accent-fill" />
                  <p className="num text-xs text-fg-muted">Block t{n.val_block}</p>
                  <p className="mt-1 text-sm leading-snug">{prettySelection(n.selected ?? "")}</p>
                  <p className="num mt-1 text-xs text-fg-muted">BA {n.balanced_accuracy.toFixed(3)} · MCC {n.mcc.toFixed(3)}</p>
                </li>
              ))}
            </ol>
            <Note>{m.ensemble}. Members were chosen only from blocks before each validation block.</Note>
          </Panel>
        </div>
      </section>

      <section className="mt-20 space-y-8">
        <SectionHead n={3} kicker="Predictions" title="What the models" accent="actually said." />
        <div className="grid gap-6 xl:grid-cols-12">
          <Panel className="xl:col-span-8" kicker={`Out-of-sample · t${m.oosSummary.from}–${m.oosSummary.to}`} title="Prediction history" tag={<Provenance kind="historical" />}>
            <PredictionHistory oos={m.oos} />
          </Panel>
          <Panel className="xl:col-span-4" kicker="Out-of-sample P(UP)" title="Confidence distribution">
            <ConfidenceHistogram oos={m.oos} />
            <Note>Probabilities cluster near 0.5: the Brier score barely beats the base rate, so position sizing stays conservative.</Note>
          </Panel>
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <Panel className="lg:col-span-7" kicker="Permutation importance, out-of-sample" title="What drives the ensemble">
            <FeatureImportanceBars rows={m.featureImportance} />
          </Panel>
          <div className="space-y-6 lg:col-span-5">
            <Panel kicker="Round 1 submission vs released labels" title="Confusion matrix" tag={<Provenance kind="submitted" />}>
              <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-sm">
                <span />
                <span className="kicker text-center text-fg-muted">Pred DOWN</span>
                <span className="kicker text-center text-fg-muted">Pred UP</span>
                {[["Actual DOWN", r1.tn, r1.fp], ["Actual UP", r1.fn, r1.tp]].map(([lab, a, b], i) => (
                  <div key={i} className="contents">
                    <span className="kicker self-center pr-2 text-fg-muted">{lab}</span>
                    {[a, b].map((v, j) => (
                      <span key={j} className={cx("num grid h-16 place-items-center rounded-xl border border-line text-2xl", i === j ? "bg-fg/[0.07]" : "")}>{v}</span>
                    ))}
                  </div>
                ))}
              </div>
              <Note>{r1.note}</Note>
            </Panel>
            <Panel kicker="Submitted prediction files" title="Rounds 1 and 2">
              <dl>
                {preds.map((p) => (
                  <KeyValue key={p.file} k={`Round ${p.round} · ${p.file}`} v={`${p.up} UP / ${p.down} DOWN · ${p.validation.ok ? "PASS" : "FAIL"}`} />
                ))}
              </dl>
              <Note>Round 2 outcomes (851–900) remain hidden, so no accuracy is shown for that file.</Note>
            </Panel>
          </div>
        </div>
      </section>
    </>
  );
}
