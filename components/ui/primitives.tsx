import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { pad2 } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** UMANG eyebrow: "(NN) — Label" */
export function Kicker({ n, children, className }: { n?: number; children: ReactNode; className?: string }) {
  return (
    <p className={cx("kicker text-fg-muted", className)}>
      {n != null && <span className="num mr-2 tracking-normal">({pad2(n)})</span>}
      {n != null && <span aria-hidden className="mr-2">—</span>}
      {children}
    </p>
  );
}

/** Page hero: kicker, display headline with serif-italic accent, lede, and a heavy rule (UMANG hero pattern). */
export function PageHero({ n, kicker, title, accent, lede, meta }: {
  n: number; kicker: string; title: string; accent?: string; lede?: ReactNode; meta?: ReactNode;
}) {
  return (
    <header className="fade-up pt-28 pb-10 sm:pt-32 lg:pb-14">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <Kicker n={n}>{kicker}</Kicker>
        {meta && <div className="num text-xs text-fg-muted">{meta}</div>}
      </div>
      <h1 className="display mt-6 text-[clamp(2.75rem,8vw,7.5rem)]">
        {title}
        {accent && (
          <>
            {" "}
            <span className="serif-i pr-[0.08em] text-accent">{accent}</span>
          </>
        )}
      </h1>
      <div className="mt-8 border-b border-line-strong" />
      {lede && <div className="mt-6 max-w-3xl text-lg leading-relaxed text-fg-muted">{lede}</div>}
    </header>
  );
}

export function SectionHead({ n, kicker, title, accent, aside, id }: {
  n?: number; kicker: string; title: string; accent?: string; aside?: ReactNode; id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-28 grid gap-4 border-b border-line pb-5 lg:grid-cols-12 lg:items-end">
      <div className="lg:col-span-8">
        <Kicker n={n}>{kicker}</Kicker>
        <h2 className="display mt-4 text-[clamp(1.9rem,4vw,3.25rem)]">
          {title} {accent && <span className="serif-i text-accent">{accent}</span>}
        </h2>
      </div>
      {aside && <div className="text-sm leading-relaxed text-fg-muted lg:col-span-4">{aside}</div>}
    </div>
  );
}

export function Panel({ children, className, title, kicker, actions, tag }: {
  children: ReactNode; className?: string; title?: ReactNode; kicker?: string; actions?: ReactNode; tag?: ReactNode;
}) {
  return (
    <section className={cx("rounded-2xl border border-line bg-panel p-5 sm:p-6", className)}>
      {(title || kicker || actions || tag) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {kicker && <p className="kicker mb-2 text-fg-muted">{kicker}</p>}
            {title && <h3 className="text-lg font-semibold leading-snug tracking-tight">{title}</h3>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tag}
            {actions}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

export type ProvenanceKind = "historical" | "submitted" | "public" | "hypothetical" | "unavailable" | "reported";
const PROV: Record<ProvenanceKind, string> = {
  historical: "Historical out-of-sample",
  submitted: "From submitted file",
  public: "Public leaderboard",
  hypothetical: "Hypothetical · assumed costs",
  unavailable: "Not available",
  reported: "Reported · unverified",
};
/** Every number on the dashboard carries one of these, so validation, file facts and leaderboard scores never blur. */
export function Provenance({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-fg-muted",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{
          background:
            kind === "public" ? "var(--accent-fill)" : kind === "unavailable" ? "transparent" : kind === "historical" ? "var(--s-ridge)" : "var(--fg-muted)",
          border: kind === "unavailable" ? "1px solid var(--fg-muted)" : undefined,
        }}
      />
      {PROV[kind]}
    </span>
  );
}

export function DirectionChip({ s, size = "md" }: { s: number; size?: "sm" | "md" }) {
  const d = s > 0 ? "Long" : s < 0 ? "Short" : "Flat";
  const Icon = s > 0 ? ArrowUpRight : s < 0 ? ArrowDownRight : Minus;
  const color = s > 0 ? "var(--long)" : s < 0 ? "var(--short)" : "var(--flat)";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
      style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, color: "var(--fg)" }}
    >
      <Icon aria-hidden className={size === "sm" ? "size-3" : "size-3.5"} style={{ color }} strokeWidth={2.4} />
      {d}
    </span>
  );
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
      <span
        aria-hidden
        className="inline-block h-0.5 w-4 rounded-full"
        style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color }}
      />
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton rounded-xl", className)} />;
}

export function KeyValue({ k, v, mono = true }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-sm text-fg-muted">{k}</dt>
      <dd className={cx("text-right text-sm", mono && "num")}>{v}</dd>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-xs leading-relaxed text-fg-muted">{children}</p>;
}
