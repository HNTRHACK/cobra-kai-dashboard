"""Export frontend-ready data for the COBRA KAI dashboard.

Run from the quant-alpha project root:   .venv/Scripts/python dashboard/scripts/build_data.py

Reads only existing project files (datasets, OOS predictions, reports, submissions). It never trains the
production models, never edits project files, and never writes outside dashboard/data/.
Privacy and integrity:
  * sma_10 / sma_30 / momentum_5 are NOT exported (in hidden rows they would allow close reconstruction).
  * close / return / target are exported only where the organisers released them (ts <= 850; target <= 849).
  * No absolute local paths are written into the output.
"""
import warnings; warnings.filterwarnings("ignore")
import sys, json, shutil, hashlib, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]; sys.path.insert(0, str(ROOT))
import numpy as np, pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import balanced_accuracy_score as BA, matthews_corrcoef as MCC, confusion_matrix
from src import backtest as bt
from src.features import build_features, FEATURE_SETS
from src.validation import make_folds
from src.regimes import crash_diagnostics, drift_report
from src.config import PERMITTED_RAW

OUT = ROOT / "dashboard" / "data"; (OUT / "derived").mkdir(parents=True, exist_ok=True); (OUT / "submissions").mkdir(parents=True, exist_ok=True)
P = lambda *a: ROOT.joinpath(*a)

def clean(x):
    if isinstance(x, dict): return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, np.ndarray)): return [clean(v) for v in x]
    if isinstance(x, (np.floating, float)): return None if not np.isfinite(x) else float(f"{float(x):.10g}")
    if isinstance(x, (np.integer,)): return int(x)
    if isinstance(x, np.bool_): return bool(x)
    return x

def dump(name, obj):
    (OUT / "derived" / f"{name}.json").write_text(json.dumps(clean(obj), separators=(",", ":")))

sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

# ------------------------------------------------------------------ market
df = pd.read_csv(P("data/processed/round3_merged.csv")); F = build_features(df)
cd = crash_diagnostics(df, F, df.index)
ts = df.timestamp.astype(int).values
vol = df.volatility_20.astype(float)
close = df.close.where(df.timestamp <= 850)
target = df.target.where(df.timestamp <= 849)
regime = np.where(cd.crash_flag.values == 1, "crash", np.where(cd.vol_z250.fillna(0).values > 1, "elevated", "normal"))
market = [dict(t=int(ts[i]), o=df.open[i], h=df.high[i], l=df.low[i], c=close[i], v=df.volume[i], vol=vol[i], rsi=df.rsi_14[i],
               vz=df.volume_z_20[i], of=df.order_flow[i], y=target[i], crash=int(cd.crash_flag.values[i]), vz250=cd.vol_z250.values[i],
               dd=cd.open_dd20.values[i], regime=str(regime[i])) for i in range(len(df))]
dump("market", {"asset": "GLACIER_GAS", "labeledThrough": 850, "hiddenFrom": 851, "rows": market})

# R1 vs R2 revision of the 801-850 window (order_flow sign inversion)
r1 = pd.read_csv(P("data/raw/GLACIER_GAS_C01_round1.csv")).set_index("timestamp")
r2 = pd.read_csv(P("data/raw/GLACIER_GAS_C01_round2.csv")).set_index("timestamp")
w = range(801, 851)
ret = (df.set_index("timestamp").close / df.set_index("timestamp").close.shift(1) - 1)
revision = [dict(t=t, of_r1=r1.loc[t, "order_flow"], of_r2=r2.loc[t, "order_flow"], ret=ret.loc[t]) for t in w]
hist_rows = df.timestamp.between(30, 800)
rev_summary = {"corr_r1_window": np.corrcoef(r1.loc[w, "order_flow"], ret.loc[w])[0, 1],
               "corr_r2_window": np.corrcoef(r2.loc[w, "order_flow"], ret.loc[w])[0, 1],
               "corr_history": np.corrcoef(df.order_flow[hist_rows], ret.values[hist_rows.values])[0, 1],
               "identical_r2_r3": sha(P("data/raw/GLACIER_GAS_C01_round2.csv")) == sha(P("data/raw/GLACIER_GAS_C01_round3.csv"))}

# distribution shift: rows 1-800 vs hidden window 851-900 (permitted columns only)
dr = drift_report(df[df.timestamp <= 800], df[df.timestamp >= 851], cols=[c for c in PERMITTED_RAW if c in df.columns])
def hist(a, b, bins):
    e = np.histogram_bin_edges(np.r_[a, b], bins=bins)
    return dict(edges=e, ref=np.histogram(a, e)[0] / len(a), cur=np.histogram(b, e)[0] / len(b))
shift = {"table": [dict(feature=k, **v) for k, v in dr.reset_index().set_index("feature").to_dict("index").items()],
         "hist": {c: hist(df[c][df.timestamp <= 800].dropna().values, df[c][df.timestamp >= 851].dropna().values, 24)
                  for c in ["volatility_20", "volume_z_20", "order_flow", "rsi_14"]}}
dump("regimes", {"revision": revision, "revisionSummary": rev_summary, "shift": shift,
                 "facts": {"open_first_hidden": df.open[df.timestamp == 851].iloc[0], "open_min_hidden": df.open[df.timestamp >= 851].min(),
                           "vol_mean_hidden": vol[df.timestamp >= 851].mean(), "vol_max_labeled": vol[df.timestamp <= 849].max(),
                           "crash_rows_hidden": int(cd.crash_flag[df.timestamp >= 851].sum()),
                           "lag1_autocorr": np.corrcoef(ret.values[30:849], ret.shift(-1).values[30:849])[0, 1]}})

# ------------------------------------------------------------------ models
mc = pd.read_csv(P("reports/model_comparison.csv"))
mc["family"] = mc.config.str.split("|").str[0].str.strip('"')
models = mc[mc.family != "NESTED"][["family", "config", "ba_mean", "ba_std", "mcc_mean", "mcc_std", "auc_mean", "brier_mean", "folds_mcc_pos", "pred_up_rate"]]
wf = pd.read_csv(P("reports/walk_forward_results.csv"))
wf["family"] = wf.config.str.split("|").str[0]
best = models.sort_values("mcc_mean", ascending=False).groupby("family").head(1).config.tolist()
per_block = wf[wf.config.isin(best) & wf.is_outer.astype(str).eq("True")][["family", "config", "val_block", "n_train", "balanced_accuracy", "mcc"]]
nested = wf[wf.config.str.startswith("NESTED")][["config", "val_block", "n_train", "balanced_accuracy", "mcc", "selected"]]

# Ridge return regression: same outer blocks 501-800 as model_comparison, leakage-safe expanding folds
cols = FEATURE_SETS["full"]; fwd = df.close.shift(-1) / df.close - 1
ridge_z = pd.Series(np.nan, index=df.index); ridge_rows = []
for f in make_folds(850):
    if f.val_idx[0] < 500: continue
    tr = f.train_idx[F.iloc[f.train_idx][cols].notna().all(axis=1).values & fwd.iloc[f.train_idx].notna().values]
    m = make_pipeline(SimpleImputer(), StandardScaler(), Ridge(alpha=100.0)).fit(F.iloc[tr][cols], fwd.iloc[tr] / vol.iloc[tr])
    z = m.predict(F.iloc[f.val_idx][cols]) / np.std(m.predict(F.iloc[tr][cols])); ridge_z.iloc[f.val_idx] = z
    va = f.val_idx[fwd.iloc[f.val_idx].notna().values]; yy = (fwd.iloc[va] > 0).astype(int); pp = (ridge_z.iloc[va] > 0).astype(int)
    if f.val_idx[0] < 800:
        ridge_rows.append(dict(family="ridge", config="ridge|full|alpha=100 (return regression)", val_block=f"{f.val_idx[0]+1}-{f.val_idx[-1]+1}",
                               n_train=len(tr), balanced_accuracy=BA(yy, pp), mcc=MCC(yy, pp)))
rr = pd.DataFrame(ridge_rows)
ridge_model = dict(family="ridge", config="ridge|full|alpha=100 (return regression)", ba_mean=rr.balanced_accuracy.mean(), ba_std=rr.balanced_accuracy.std(),
                   mcc_mean=rr.mcc.mean(), mcc_std=rr.mcc.std(), auc_mean=None, brier_mean=None, folds_mcc_pos=int((rr.mcc > 0).sum()), pred_up_rate=None)
fi = pd.read_csv(P("reports/feature_importance.csv")).groupby("feature").weighted_perm_auc_drop.first().sort_values(ascending=False).head(15)
folds = [dict(k=f.k, train=[int(f.train_idx[0]) + 1, int(f.train_idx[-1]) + 1], purge=int(f.train_idx[-1]) + 2, val=[int(f.val_idx[0]) + 1, int(f.val_idx[-1]) + 1])
         for f in make_folds(850)]

O = pd.read_csv(P("data/processed/round3_oos_probs.csv"))
oos = [dict(t=int(r.row) + 1, p=r.p_raw, y=None if pd.isna(r.y) else int(r.y), fold=int(r.fold)) for r in O.itertuples()]
Ov = O.dropna(subset=["y"])
r1p = pd.read_csv(P("submissions/round1_predictions.csv")); y1 = df.set_index("timestamp").target.loc[r1p.timestamp].astype(int).values
cm = confusion_matrix(y1, r1p.prediction.values, labels=[0, 1])
round1_eval = dict(ba=BA(y1, r1p.prediction), mcc=MCC(y1, r1p.prediction), tn=cm[0, 0], fp=cm[0, 1], fn=cm[1, 0], tp=cm[1, 1], n=len(y1),
                   note="Scored against labels the organisers released with the Round 2 file. Organiser score is separate.")
dump("models", {"models": models.to_dict("records") + [ridge_model], "perBlock": per_block.to_dict("records") + rr.to_dict("records"),
                "nested": nested.to_dict("records"), "featureImportance": [dict(feature=k, drop=v) for k, v in fi.items()],
                "folds": folds, "oos": oos, "oosSummary": {"ba": BA(Ov.y.astype(int), (Ov.p_raw > .5).astype(int)), "mcc": MCC(Ov.y.astype(int), (Ov.p_raw > .5).astype(int)),
                "n": len(Ov), "from": int(Ov.row.min()) + 1, "to": int(Ov.row.max()) + 1}, "round1Eval": round1_eval,
                "ensemble": "Top-3 equal-weight ensemble (HistGB, LightGBM full, LightGBM full_rel), 5-seed bagging from Round 2"})

# ------------------------------------------------------------------ backtests (historical OOS only; each 50-day block starts flat)
D = pd.DataFrame({"t": O.row + 1, "row": O.row, "block": O.fold, "p": O.p_raw}).set_index("row")
D["fwd"] = fwd.loc[D.index].values; D["vol"] = vol.loc[D.index].values; D["rz"] = ridge_z.loc[D.index].values
D = D.dropna(subset=["fwd"])
VT = lambda v: np.clip(0.008 / np.asarray(v), 0, 2)
def smooth(s, a=0.5):
    out, prev = np.zeros(len(s)), 0.0
    for i, x in enumerate(s): out[i] = prev = a * prev + (1 - a) * x
    return out
sel = pd.read_pickle(P("research/selective_alpha/results.pkl")); SP = sel["P"].set_index("row"); TAU = sel["TAU"]
def notrade(s, band=0.05):
    out, prev = np.zeros(len(s)), 0.0
    for i, x in enumerate(s):
        if abs(x - prev) >= band or (x == 0 and prev != 0): prev = x
        out[i] = prev
    return out
def selective(g):
    rz, pm, ood, v = SP.loc[g.index, "rz"].values, SP.loc[g.index, "pm"].values, SP.loc[g.index, "ood"].values, g.vol.values
    s = np.where(pm > TAU, np.clip(0.5 * rz, -1, 1) * VT(v), 0.0)
    s = np.where(ood > 0.40, 0.0, np.where(ood > 0.20, 0.25 * s, s)); return np.clip(notrade(s), -1, 1)
pos = {"baseline": [], "ridge": [], "selective": []}
for b, g in D.groupby("block"):
    pos["baseline"].append(bt.make_signal(g.p.values, g.vol.values, **bt.FIXED_POLICIES[bt.DEFAULT_POLICY]))
    pos["ridge"].append(np.clip(smooth(np.clip(0.5 * g.rz.values, -1, 1) * VT(g.vol.values)), -1, 1))
    pos["selective"].append(selective(g))
for k in pos: D[k] = np.concatenate(pos[k])
check = {}
for k in pos:
    check[k] = {c: float(np.mean([bt.backtest(g[k].values, g.fwd.values, c)["sharpe"] for _, g in D.groupby("block")])) for c in (0, 5, 10, 20)}
days = [dict(t=int(r.t), block=int(r.block), fwd=r.fwd, vol=r.vol, baseline=r.baseline, ridge=r.ridge, selective=r.selective) for r in D.itertuples()]
dump("backtest", {"days": days, "pythonCheckSharpe": check, "costsBps": [0, 5, 10, 20],
                  "significance": {"ridge_vs_baseline_p": 0.43, "selective_vs_ridge_p": float(sel["sig"]["vs_ridge"]), "bar": 0.05 / 45, "candidates_tested": 45},
                  "strategies": {
                      "baseline": {"name": "Volatility-target classifier", "short": "Original", "desc": "Ensemble P(UP) → linear ×5, vol target 0.8%, EMA 0.5. Submitted Round 3 strategy (6.70)."},
                      "ridge": {"name": "Ridge return regression", "short": "Ridge", "desc": "Ridge (α=100) on vol-scaled next return, z-score ×0.5, vol target 0.8%, EMA 0.5."},
                      "selective": {"name": "Selective two-stage", "short": "Selective", "desc": f"Meta-logistic trade filter (τ={TAU}) + ridge direction, OOD safeguard, 0.05 no-trade band."}},
                  "v2": "Not available. V2's generating code is unavailable, so no historical backtest can be computed."})

# ------------------------------------------------------------------ signals (hidden window) + submission copies
T = pd.read_csv(P("data/processed/round3_test_probs.csv"))
dump("window", {"rows": [dict(t=int(r.timestamp), vol=r.volatility_20, crash=int(r.crash_flag), p=r.p_up,
                                regime=str(regime[df.index[df.timestamp == r.timestamp][0]])) for r in T.itertuples()]})
copies = {"round1_predictions.csv": P("submissions/round1_predictions.csv"), "round2_predictions.csv": P("submissions/round2_predictions.csv"),
          "round3_signals_WINNING_CANDIDATE.csv": P("submissions/round3_signals_WINNING_CANDIDATE.csv"),
          "round3_signals_CHALLENGER_ridge.csv": P("submissions/round3_signals_CHALLENGER_ridge.csv"),
          "round3_signals_v2.csv": P("frozen/round3_v2_incumbent/round3_signals_v2.csv")}
manifest = {}
for n, src in copies.items():
    shutil.copyfile(src, OUT / "submissions" / n); manifest[n] = sha(src)
dump("manifest", {"files": manifest, "generatedFrom": "quant-alpha project files (paths omitted)"})
print("Python check, mean block Sharpe:", {k: {c: round(v, 3) for c, v in d.items()} for k, d in check.items()})
print("round1 eval:", {k: round(v, 3) if isinstance(v, float) else v for k, v in round1_eval.items() if k != "note"})
print("wrote", sorted(p.name for p in (OUT / "derived").iterdir()), sorted(p.name for p in (OUT / "submissions").iterdir()))
