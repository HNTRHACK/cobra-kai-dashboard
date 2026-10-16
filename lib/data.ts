// Server-side ingestion layer. Reads ./data at build time, validates shapes, and returns
// frontend-ready objects. Runs only in Server Components (uses node:fs).
import { readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { parseNumericCsv, validatePredictions, validateSignals, SchemaError, type Validation } from "./csv";
import { signalStats, type Day, type SignalStats } from "./metrics";

const DATA = path.join(process.cwd(), "data");

function readJson<T>(rel: string, guard: (x: unknown) => boolean): T {
  const raw = JSON.parse(readFileSync(path.join(DATA, rel), "utf8"));
  if (!guard(raw)) throw new SchemaError(`${rel}: unexpected schema`);
  return raw as T;
}
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const hasArray = (k: string) => (x: unknown) => isObj(x) && Array.isArray(x[k]);

// ---------- types
export type MarketRow = {
  t: number; o: number; h: number; l: number; c: number | null; v: number; vol: number; rsi: number; vz: number; of: number;
  y: number | null; crash: number; vz250: number | null; dd: number | null; regime: "normal" | "elevated" | "crash";
};
export type Market = { asset: string; labeledThrough: number; hiddenFrom: number; rows: MarketRow[] };

export type ModelRow = {
  family: string; config: string; ba_mean: number; ba_std: number; mcc_mean: number; mcc_std: number;
  auc_mean: number | null; brier_mean: number | null; folds_mcc_pos: number; pred_up_rate: number | null;
};
export type Models = {
  models: ModelRow[];
  perBlock: { family: string; config: string; val_block: string; n_train: number; balanced_accuracy: number; mcc: number }[];
  nested: { config: string; val_block: string; n_train: number; balanced_accuracy: number; mcc: number; selected: string | null }[];
  featureImportance: { feature: string; drop: number }[];
  folds: { k: number; train: [number, number]; purge: number; val: [number, number] }[];
  oos: { t: number; p: number; y: number | null; fold: number }[];
  oosSummary: { ba: number; mcc: number; n: number; from: number; to: number };
  round1Eval: { ba: number; mcc: number; tn: number; fp: number; fn: number; tp: number; n: number; note: string };
  ensemble: string;
};
export type Regimes = {
  revision: { t: number; of_r1: number; of_r2: number; ret: number }[];
  revisionSummary: { corr_r1_window: number; corr_r2_window: number; corr_history: number; identical_r2_r3: boolean };
  shift: {
    table: { feature: string; ref_mean: number; cur_mean: number; ref_std: number; cur_std: number; std_ratio: number; mean_shift_in_ref_sd: number; ks_stat: number; ks_p: number }[];
    hist: Record<string, { edges: number[]; ref: number[]; cur: number[] }>;
  };
  facts: { open_first_hidden: number; open_min_hidden: number; vol_mean_hidden: number; vol_max_labeled: number; crash_rows_hidden: number; lag1_autocorr: number };
};
export type Backtest = {
  days: Day[];
  pythonCheckSharpe: Record<string, Record<string, number>>;
  costsBps: number[];
  significance: { ridge_vs_baseline_p: number; selective_vs_ridge_p: number; bar: number; candidates_tested: number };
  strategies: Record<string, { name: string; short: string; desc: string }>;
  v2: string;
};
export type WindowRow = { t: number; vol: number; crash: number; p: number; regime: MarketRow["regime"] };
export type Competition = {
  _provenance: string;
  rounds: { round: number; title: string; window: string; task: string; submitted: string; publicScore: number; story: string }[];
  round3Uploads: { label: string; file: string | null; publicScore: number; active: boolean; note: string }[];
  standings: { label: string; rank: number; of: number | null; cumulative: number; note: string }[];
  milestones: { step: string; detail: string }[];
};

export type SignalFile = {
  key: "v2" | "original" | "ridge";
  label: string;
  file: string;
  signals: { t: number; s: number }[];
  stats: SignalStats;
  validation: Validation;
};
export type PredictionFile = {
  round: 1 | 2;
  file: string;
  rows: { t: number; pred: number; conf: number }[];
  validation: Validation;
  up: number;
  down: number;
};

// ---------- loaders (memoised per render)
export const getMarket = cache(() => {
  const m = readJson<Market>("derived/market.json", hasArray("rows"));
  // integrity: nothing hidden may leak into the frontend payload
  for (const r of m.rows) {
    if (r.t > m.labeledThrough && r.c !== null) throw new SchemaError(`close present for hidden row ${r.t}`);
    if (r.t >= m.labeledThrough && r.y !== null) throw new SchemaError(`target present for unlabeled row ${r.t}`);
    if ("sma_10" in r || "momentum_5" in r) throw new SchemaError("forbidden column exported");
  }
  return m;
});
export const getModels = cache(() => readJson<Models>("derived/models.json", hasArray("models")));
export const getRegimes = cache(() => readJson<Regimes>("derived/regimes.json", hasArray("revision")));
export const getBacktest = cache(() => readJson<Backtest>("derived/backtest.json", hasArray("days")));
export const getWindow = cache(() => readJson<{ rows: WindowRow[] }>("derived/window.json", hasArray("rows")).rows);
export const getCompetition = cache(() => readJson<Competition>("manual/competition.json", hasArray("rounds")));

const SIGNAL_FILES: { key: SignalFile["key"]; label: string; file: string }[] = [
  { key: "v2", label: "V2 · active upload", file: "round3_signals_v2.csv" },
  { key: "original", label: "Original vol-target", file: "round3_signals_WINNING_CANDIDATE.csv" },
  { key: "ridge", label: "Ridge challenger", file: "round3_signals_CHALLENGER_ridge.csv" },
];

export const getSignalFiles = cache((): SignalFile[] =>
  SIGNAL_FILES.map(({ key, label, file }) => {
    const { header, rows } = parseNumericCsv(readFileSync(path.join(DATA, "submissions", file), "utf8"));
    const validation = validateSignals(header, rows);
    const signals = rows.map((r) => ({ t: r[0], s: r[1] }));
    return { key, label, file, signals, stats: signalStats(signals.map((x) => x.s)), validation };
  }),
);

export const getPredictionFiles = cache((): PredictionFile[] =>
  ([[1, "round1_predictions.csv", 801], [2, "round2_predictions.csv", 851]] as const).map(([round, file, first]) => {
    const { header, rows } = parseNumericCsv(readFileSync(path.join(DATA, "submissions", file), "utf8"));
    const parsed = rows.map((r) => ({ t: r[0], pred: r[1], conf: r[2] }));
    return {
      round, file, rows: parsed, validation: validatePredictions(header, rows, first),
      up: parsed.filter((r) => r.pred === 1).length, down: parsed.filter((r) => r.pred === 0).length,
    };
  }),
);
