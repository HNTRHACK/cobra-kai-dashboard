import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getCompetition, getPredictionFiles, getSignalFiles } from "@/lib/data";
import { pad2 } from "@/lib/format";
import { Kicker, Note, PageHero, Panel, Provenance, SectionHead, cx } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Competition performance" };

export default function CompetitionPage() {
  const c = getCompetition();
  const signals = getSignalFiles();
  const preds = getPredictionFiles();
  const latest = c.standings[c.standings.length - 1];
  const maxScore = Math.max(...c.rounds.map((r) => r.publicScore), ...c.round3Uploads.map((u) => u.publicScore));
  const fileFacts = (file: string | null) => {
    if (!file) return null;
    const s = signals.find((x) => x.file === file);
    if (s) return `${s.stats.long} L / ${s.stats.short} S / ${s.stats.flat} F · ${s.validation.ok ? "format PASS" : "format FAIL"}`;
    const p = preds.find((x) => x.file === file);
    return p ? `${p.up} UP / ${p.down} DOWN · ${p.validation.ok ? "format PASS" : "format FAIL"}` : null;
  };

  return (
    <>
      <PageHero
        n={6}
        kicker="Competition performance"
        title="Three rounds,"
        accent="one campaign."
        meta="public scores · reported by the team"
        lede={<>Scores here are public leaderboard values, reported by the team. Round 3&apos;s public score covers 50% of rows. Final and private results are not verified, and the round weights are not official, so they aren&apos;t shown.</>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {c.rounds.map((r) => (
          <Stat key={r.round} label={`Round ${r.round} · public`} value={r.publicScore} fmt={{ decimals: 2 }} sub={r.title} tag={<Provenance kind="public" />} accent={r.round === 3} />
        ))}
        <Stat label="Cumulative · displayed" value={latest.cumulative} fmt={{ decimals: 2 }} sub={`Rank ${latest.rank}${latest.of ? ` of ${latest.of}` : ""} · approximate, not final`} tag={<Provenance kind="reported" />} />
      </div>

      <section className="mt-20 space-y-8">
        <SectionHead n={1} kicker="Journey" title="From forecasts" accent="to positions." />
        <ol className="border-t border-line-strong">
          {c.rounds.map((r) => (
            <li key={r.round} className="grid gap-6 border-b border-line py-10 lg:grid-cols-12">
              <div className="lg:col-span-2">
                <span className="font-serif text-[clamp(4rem,9vw,8rem)] leading-none text-fg/10 italic">{pad2(r.round)}</span>
              </div>
              <div className="lg:col-span-6">
                <Kicker>Round {r.round} · t{r.window}</Kicker>
                <h3 className="display mt-3 text-4xl sm:text-5xl">{r.title}</h3>
                <p className="mt-4 max-w-xl leading-relaxed text-fg-muted">{r.story}</p>
              </div>
              <dl className="self-end lg:col-span-4">
                <div className="flex items-baseline justify-between border-b border-line py-2.5"><dt className="text-sm text-fg-muted">Task</dt><dd className="text-sm">{r.task}</dd></div>
                <div className="flex items-baseline justify-between border-b border-line py-2.5"><dt className="text-sm text-fg-muted">Scored file</dt><dd className="num text-xs">{r.submitted}</dd></div>
                <div className="flex items-baseline justify-between border-b border-line py-2.5"><dt className="text-sm text-fg-muted">File facts</dt><dd className="num text-xs">{fileFacts(r.submitted) ?? "—"}</dd></div>
                <div className="flex items-baseline justify-between py-2.5"><dt className="text-sm text-fg-muted">Public score</dt><dd className="num text-3xl text-accent">{r.publicScore.toFixed(2)}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 space-y-8">
        <SectionHead n={2} kicker="Round 3 uploads" title="Only the latest" accent="upload counts." aside="Public scores for each Round 3 version the team uploaded. Upload order beyond 'V2 is latest' is not recorded here." />
        <Panel tag={<Provenance kind="public" />} kicker="Public score, Round 3" title="Submission history">
          <ul className="space-y-4">
            {c.round3Uploads.map((u) => (
              <li key={u.label} className="grid gap-3 sm:grid-cols-[9rem_1fr_5rem] sm:items-center">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {u.label}
                  {u.active && <span className="rounded-full bg-accent-fill px-2 py-0.5 text-[10px] font-semibold text-on-accent">ACTIVE</span>}
                </span>
                <div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-fg/10" role="img" aria-label={`${u.label} public score ${u.publicScore}`}>
                    <div className={cx("h-full rounded-full", u.active ? "bg-accent-fill" : "bg-fg/40")} style={{ width: `${(u.publicScore / maxScore) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                    {u.file ? <span className="num">{u.file} · {fileFacts(u.file)}</span> : "File not available locally"} — {u.note}
                  </p>
                </div>
                <span className="num text-right text-xl">{u.publicScore.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="mt-20 space-y-8">
        <SectionHead n={3} kicker="Standings" title="Leaderboard" accent="snapshots." />
        <div className="grid gap-6 lg:grid-cols-2">
          {c.standings.map((s) => (
            <Panel key={s.label} kicker={s.label} title={<span className="num text-5xl font-medium">#{s.rank}{s.of ? <span className="text-xl text-fg-muted"> / {s.of}</span> : null}</span>} tag={<Provenance kind="reported" />}>
              <p className="num text-sm">Cumulative {s.cumulative.toFixed(2)}</p>
              <Note>{s.note}</Note>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-20 space-y-8">
        <SectionHead n={4} kicker="Model progression" title="How the system" accent="evolved." />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.milestones.map((m, i) => (
            <li key={m.step} className="rounded-2xl border border-line bg-panel p-5">
              <span className="num text-xs text-fg-muted">{pad2(i + 1)}</span>
              <p className="mt-3 flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-accent" aria-hidden />{m.step}</p>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{m.detail}</p>
            </li>
          ))}
        </ol>
        <Note>{c._provenance}</Note>
      </section>
    </>
  );
}
