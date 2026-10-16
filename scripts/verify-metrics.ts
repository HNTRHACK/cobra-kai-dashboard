// Cross-checks the dashboard's TypeScript backtest engine against the Python engine (src/backtest.py)
// and re-validates exported data before every build. Run: node scripts/verify-metrics.ts (Node >= 23.6 strips types).
import { readFileSync } from "node:fs";
import { runStrategy, signalStats, type Day } from "../lib/metrics.ts";

const bt = JSON.parse(readFileSync(new URL("../data/derived/backtest.json", import.meta.url), "utf8")) as {
  days: Day[]; pythonCheckSharpe: Record<string, Record<string, number>>;
};
const market = JSON.parse(readFileSync(new URL("../data/derived/market.json", import.meta.url), "utf8")) as {
  labeledThrough: number; rows: Record<string, unknown>[];
};

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

for (const [key, byCost] of Object.entries(bt.pythonCheckSharpe)) {
  for (const [cost, py] of Object.entries(byCost)) {
    const ts = runStrategy(bt.days, key, Number(cost)).meanBlockSharpe;
    check(Math.abs(ts - py) < 1e-6, `${key} @${cost}bps mean block Sharpe  ts=${ts.toFixed(6)}  py=${py.toFixed(6)}`);
  }
}

// integrity: no hidden close/target, no close-derived columns
const hiddenClose = market.rows.filter((r) => (r.t as number) > market.labeledThrough && r.c !== null).length;
const hiddenTarget = market.rows.filter((r) => (r.t as number) >= market.labeledThrough && r.y !== null).length;
const forbidden = market.rows.some((r) => "sma_10" in r || "sma_30" in r || "momentum_5" in r || "return_1d" in r);
check(hiddenClose === 0, "no hidden-window closes in market.json");
check(hiddenTarget === 0, "no unreleased targets in market.json");
check(!forbidden, "no sma/momentum/return columns exported");

// V2 facts recomputed from the CSV
const csv = readFileSync(new URL("../data/submissions/round3_signals_v2.csv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1);
const v2 = signalStats(csv.map((l) => Number(l.split(",")[1])));
check(v2.n === 50 && v2.long === 13 && v2.short === 0 && v2.flat === 37, `V2 counts ${v2.long}/${v2.short}/${v2.flat}, avg exposure ${v2.avgExposure.toFixed(4)}`);

// no local paths leaked into exported data
const blob = ["backtest", "market", "models", "regimes", "window", "manifest"].map((n) => readFileSync(new URL(`../data/derived/${n}.json`, import.meta.url), "utf8")).join("");
check(!/[A-Z]:\\\\|\/Users\/|\\Users\\|AppData/i.test(blob), "no local file paths in exported data");

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed.");
