# COBRA KAI: Quantitative Trading Intelligence

*Built for volatility. Driven by intelligence.*

This dashboard tells the story of the GLACIER_GAS competition:
- market analysis;
- leakage-safe ML validation;
- the flash-crash regime;
- Round 3 trading signals;
- hypothetical backtests;
- public leaderboard results.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, fully static) |
| Language / UI | TypeScript, React 19 |
| Styling | Tailwind CSS v4 |
| Motion | Motion (`motion/react`) |
| Charts | Recharts for analytics; TradingView Lightweight Charts for the candlestick view |
| Icons | Lucide |

## Design system

The UI reuses the visual language of the UMANG site (umang-roan.vercel.app). Its source wasn't available locally, so the tokens below come from its deployed stylesheet and markup:

| Element | What carries over |
|---|---|
| Palette | ink `#0b0a09`, ivory `#f3eee4`, marigold `#e0a33a`, mist / muted greys |
| Typography | Instrument Serif italic accents, Inter Tight body; `.display`, `.serif-i`, `.kicker` roles |
| Motion | expo easing `cubic-bezier(.16,1,.3,1)`, `fade-up`, `screen-in`, marquee ticker |
| Header and lists | fixed `mix-blend-difference` header, `(NN) — Label` eyebrows, numbered option rows, hairline rules, pill controls |

Dashboard extensions:
- **Theme tokens:** semantic tokens for light and dark (dark is the default, as on UMANG).
- **Data colours:** strategy colours and the long/short pair were validated for colour-vision deficiency and contrast in both themes.
- **Provenance:** a tag on every metric names its source.

## Data pipeline (no fabricated metrics)

```
quant-alpha project files ──► scripts/build_data.py ──► data/derived/*.json  (sanitised)
                                                  └──► data/submissions/*.csv (copies)
data/manual/competition.json   (hand-entered public scores, labelled as reported)
lib/data.ts  ── server-side ingestion: reads + schema-validates the files above at build time
lib/csv.ts   ── strict CSV parsing + submission-format validation (50 rows, 851–900, [-1, 1])
lib/metrics.ts ─ signal stats + backtest engine (mirrors src/backtest.py)
scripts/verify-metrics.ts ── runs before every build (see Integrity rules)
```

## Integrity rules (enforced in code)

- **Withheld data stays withheld.** `sma_10`, `sma_30` and `momentum_5` are never exported. Hidden-window closes and unreleased targets are `null`, and the build fails if they aren't. The market chart draws only the permitted open price for t851–900.
- **Counts come from the CSVs.** Long, short and flat counts, exposure and turnover (V2: 13 / 0 / 37, average exposure 0.049) are recomputed from the CSVs at build time, never typed in.
- **Backtests cover historical data only.** They run on out-of-sample days t551–849 and are labelled hypothetical, with assumed costs. The TypeScript engine is checked against the Python engine before every build: the mean block Sharpe must match to 1e-6.
- **No invented V2 history.** V2's historical performance is shown as *Not available*, because its generating code is unavailable.
- **Scores are labelled by source.** Leaderboard values are tagged *Public leaderboard* or *Reported · unverified*. Round weights aren't shown because they aren't official.
- **No local file paths in output.** The build fails if any appear in the exported data.

## Run locally

Requirements: Node ≥ 23.6 (24 recommended) and the project's Python `.venv` (only needed to refresh data).

```bash
cd dashboard
npm install
npm run data        # optional: regenerate data/ from the quant-alpha project (Windows .venv path)
npm run dev         # http://localhost:3000
```

Production build (runs `verify-metrics` first, then `next build`):

```bash
npm run build
npm run start       # http://localhost:3000
```

Other scripts: `npm run typecheck`, `npm run verify`.

## Deploy (Vercel)

1. Push the repository and import it in Vercel.
2. Set **Root Directory** to `dashboard`. The framework preset is detected as Next.js.
3. Commit `dashboard/data/`. The build reads it, and Vercel has no access to the Python project.
4. Every route is prerendered as static, so no environment variables or secrets are needed.

The pages contain no API keys and no local paths.

## Pages

| Route | Content |
|---|---|
| `/` | Status strip, KPI cards, candlestick / volume / volatility chart with crash annotation and signal markers, regime transition |
| `/models` | Model comparison, walk-forward fold diagram, per-block MCC, nested selection timeline, prediction history, confidence distribution, feature importance, Round 1 confusion matrix |
| `/regimes` | Volatility regimes, regime timeline, volume shocks, RSI, Round 1 order-flow sign inversion, distribution shift |
| `/signals` | Signal explorer for V2, the original vol-target file and the Ridge challenger: counts, exposure, turnover, position path, keyboard-navigable table, detail panel, format validation |
| `/backtest` | Cost selector, equity, drawdown, activity, block returns, cost sensitivity, return distribution, comparison table, multiple-testing note |
| `/competition` | Round journey, Round 3 upload history, leaderboard snapshots, model progression |

## Accessibility

- **Keyboard:** skip link; arrow-key radio groups; Enter/Space row selection in the signal table; the mobile menu closes on Escape.
- **Visual:** focus rings; text uses text tokens; every multi-series chart has a legend; direction chips pair an icon with a label, so colour never carries meaning alone.
- **Motion:** with `prefers-reduced-motion`, counters, the ticker and page transitions don't animate.
