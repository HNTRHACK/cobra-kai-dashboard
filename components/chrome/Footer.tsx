import Link from "next/link";
import { NAV } from "@/lib/nav";

export function Ticker({ items }: { items: string[] }) {
  const row = (
    <div className="flex shrink-0 items-center gap-10 pr-10">
      {items.map((t, i) => (
        <span key={i} className="flex items-center gap-10">
          <span className="num text-sm whitespace-nowrap text-fg-2">{t}</span>
          <span aria-hidden className="text-accent">✶</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative overflow-hidden border-y border-line py-4" aria-label="Key figures">
      <ul className="sr-only">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div aria-hidden className="marquee flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-32 overflow-hidden border-t border-line px-4 pt-10 pb-12 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-[1600px] gap-10 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="kicker text-fg-muted">COBRA KAI · Quantitative Trading Intelligence</p>
          <p className="serif-i mt-4 text-3xl">Built for volatility. Driven by intelligence.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm lg:col-span-3">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="link-line w-fit text-fg-muted hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs leading-relaxed text-fg-muted lg:col-span-3">
          Independent competition project. Backtests are hypothetical, computed only on historical out-of-sample data with assumed
          transaction costs. Leaderboard values are public scores reported by the team, not final results. Nothing here is
          investment advice or a guarantee of future performance. Hidden closing prices and labels are never reconstructed or shown.
        </p>
      </div>
      <p aria-hidden className="display mx-auto mt-16 max-w-[1600px] text-center text-[19vw] leading-[0.8] tracking-tighter text-fg/[0.07]">
        COBRA KAI
      </p>
    </footer>
  );
}
