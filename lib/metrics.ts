// Pure, dependency-free metrics shared by server and client.
// The backtest mirrors src/backtest.py exactly:
//   pnl_t = pos_t * fwd_t - cost_bps/1e4 * |pos_t - pos_{t-1}|, each 50-day block starts flat,
//   Sharpe = mean/sd(ddof=1) * sqrt(252), drawdown from a running peak that includes the start (1.0).

export const ANN = 252;

export type SignalStats = {
  n: number;
  long: number;
  short: number;
  flat: number;
  avgExposure: number; // mean |signal|
  netExposure: number; // mean signal
  totalTurnover: number; // sum |Δsignal| including entry from flat
  avgTurnover: number;
  maxAbs: number;
};

export function signalStats(signals: number[]): SignalStats {
  const n = signals.length;
  let long = 0, short = 0, flat = 0, abs = 0, net = 0, turn = 0, prev = 0, maxAbs = 0;
  for (const s of signals) {
    if (s > 0) long++;
    else if (s < 0) short++;
    else flat++;
    abs += Math.abs(s);
    net += s;
    turn += Math.abs(s - prev);
    prev = s;
    maxAbs = Math.max(maxAbs, Math.abs(s));
  }
  return {
    n, long, short, flat,
    avgExposure: n ? abs / n : 0,
    netExposure: n ? net / n : 0,
    totalTurnover: turn,
    avgTurnover: n ? turn / n : 0,
    maxAbs,
  };
}

export type BlockResult = {
  block: number;
  totalReturn: number;
  sharpe: number;
  maxDrawdown: number;
  avgTurnover: number;
  avgExposure: number;
  pnl: number[];
};

function mean(a: number[]) {
  return a.reduce((x, y) => x + y, 0) / (a.length || 1);
}
function sd(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
}

export function backtestBlock(pos: number[], fwd: number[], costBps: number, block = 0): BlockResult {
  const pnl: number[] = [];
  let prev = 0, eq = 1, peak = 1, mdd = 0, turn = 0, expo = 0;
  for (let i = 0; i < pos.length; i++) {
    const d = Math.abs(pos[i] - prev);
    const p = pos[i] * fwd[i] - (costBps / 1e4) * d;
    pnl.push(p);
    eq *= 1 + p;
    peak = Math.max(peak, eq);
    mdd = Math.min(mdd, eq / peak - 1);
    turn += d;
    expo += Math.abs(pos[i]);
    prev = pos[i];
  }
  const s = sd(pnl);
  const active = pos.some((x) => x !== 0);
  return {
    block,
    totalReturn: eq - 1,
    sharpe: active && s > 0 ? (mean(pnl) / s) * Math.sqrt(ANN) : 0,
    maxDrawdown: mdd,
    avgTurnover: turn / (pos.length || 1),
    avgExposure: expo / (pos.length || 1),
    pnl,
  };
}

export type Day = { t: number; block: number; fwd: number; vol: number; [k: string]: number };

export type StrategySummary = {
  key: string;
  blocks: BlockResult[];
  meanBlockReturn: number;
  meanBlockSharpe: number;
  worstBlockReturn: number;
  worstDrawdown: number;
  avgTurnover: number;
  avgExposure: number;
  positiveBlocks: number;
  // chained daily path (blocks concatenated, each block re-entering from flat)
  curve: { t: number; equity: number; drawdown: number; pnl: number; pos: number }[];
  chainedReturn: number;
  chainedMaxDrawdown: number;
};

export function runStrategy(days: Day[], key: string, costBps: number): StrategySummary {
  const byBlock = new Map<number, Day[]>();
  for (const d of days) {
    if (!byBlock.has(d.block)) byBlock.set(d.block, []);
    byBlock.get(d.block)!.push(d);
  }
  const blocks: BlockResult[] = [];
  const curve: StrategySummary["curve"] = [];
  let eq = 1, peak = 1, chainedMdd = 0;
  for (const [b, rows] of [...byBlock.entries()].sort((a, z) => a[0] - z[0])) {
    const pos = rows.map((r) => r[key]);
    const res = backtestBlock(pos, rows.map((r) => r.fwd), costBps, b);
    blocks.push(res);
    res.pnl.forEach((p, i) => {
      eq *= 1 + p;
      peak = Math.max(peak, eq);
      const dd = eq / peak - 1;
      chainedMdd = Math.min(chainedMdd, dd);
      curve.push({ t: rows[i].t, equity: eq, drawdown: dd, pnl: p, pos: pos[i] });
    });
  }
  return {
    key,
    blocks,
    meanBlockReturn: mean(blocks.map((b) => b.totalReturn)),
    meanBlockSharpe: mean(blocks.map((b) => b.sharpe)),
    worstBlockReturn: Math.min(...blocks.map((b) => b.totalReturn)),
    worstDrawdown: Math.min(...blocks.map((b) => b.maxDrawdown)),
    avgTurnover: mean(blocks.map((b) => b.avgTurnover)),
    avgExposure: mean(blocks.map((b) => b.avgExposure)),
    positiveBlocks: blocks.filter((b) => b.totalReturn > 0).length,
    curve,
    chainedReturn: eq - 1,
    chainedMaxDrawdown: chainedMdd,
  };
}

export function histogram(values: number[], bins: number, lo?: number, hi?: number) {
  const a = lo ?? Math.min(...values);
  const b = hi ?? Math.max(...values);
  const w = (b - a) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({ x0: a + i * w, x1: a + (i + 1) * w, count: 0 }));
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - a) / w)));
    out[i].count++;
  }
  return out;
}
