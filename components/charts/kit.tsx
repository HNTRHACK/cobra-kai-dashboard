"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/primitives";

/** Shared tooltip card for every Recharts chart: text in ink tokens, a colour swatch carries identity. */
export function TipCard({ title, rows }: { title: ReactNode; rows: { color?: string; label: ReactNode; value: ReactNode }[] }) {
  return (
    <div className="min-w-44 rounded-xl border border-line bg-panel/95 px-3 py-2.5 text-xs shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)] backdrop-blur">
      <p className="num mb-1.5 text-fg">{title}</p>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-muted">
              {r.color && <span aria-hidden className="size-2 rounded-full" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="num text-fg">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const axis = {
  tick: { fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const MarketChartLazy = dynamic(() => import("./MarketChart"), {
  ssr: false,
  loading: () => (
    <div>
      <Skeleton className="mb-4 h-10 w-80" />
      <Skeleton className="h-[460px] sm:h-[520px]" />
    </div>
  ),
});
