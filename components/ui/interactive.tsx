"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./primitives";

export type NumFormat = { decimals?: number; suffix?: string; prefix?: string; signed?: boolean };
export function formatNum(x: number, { decimals = 0, suffix = "", prefix = "", signed = false }: NumFormat = {}) {
  return `${signed && x > 0 ? "+" : ""}${prefix}${x.toFixed(decimals)}${suffix}`;
}

/** Animated numerical counter; renders the final value immediately for reduced motion and SSR.
 *  Takes a serialisable format spec so Server Components can render it. */
export function CountUp({ value, fmt }: { value: number; fmt?: NumFormat }) {
  const format = (x: number) => formatNum(x, fmt);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || reduce || started.current || !Number.isFinite(value)) return;
    started.current = true;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [inView, reduce, value]);

  return (
    <span ref={ref} aria-label={format(value)}>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}

export function Stat({
  label, value, fmt, sub, tag, accent,
}: {
  label: string; value: number | null; fmt?: NumFormat; sub?: ReactNode; tag?: ReactNode; accent?: boolean;
}) {
  return (
    <div className="group flex min-h-40 flex-col justify-between rounded-2xl border border-line bg-panel p-5 transition-colors duration-500 hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <p className="kicker text-fg-muted">{label}</p>
      </div>
      <div className="mt-6">
        <p className={cx("num text-[clamp(2rem,3.4vw,2.75rem)] leading-none font-medium", accent && "text-accent")}>
          {value == null ? <span className="text-lg text-fg-muted">Not available</span> : <CountUp value={value} fmt={fmt} />}
        </p>
        {sub && <p className="mt-2 text-xs leading-relaxed text-fg-muted">{sub}</p>}
        {tag && <div className="mt-3">{tag}</div>}
      </div>
    </div>
  );
}

/** Segmented control (radio group semantics, arrow-key navigation). */
export function Segmented<T extends string | number>({
  options, value, onChange, label, size = "md",
}: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; size?: "sm" | "md";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.value === value);
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-full border border-line p-1">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={active}
            tabIndex={active || (idx === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const n = (i + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
              onChange(options[n].value);
              refs.current[n]?.focus();
            }}
            className={cx(
              "rounded-full font-medium transition-colors duration-300",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active ? "bg-fg text-bg" : "text-fg-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle chip for multi-select series visibility. */
export function ToggleChip({ on, onClick, color, children }: { on: boolean; onClick: () => void; color: string; children: ReactNode }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-300",
        on ? "border-line-strong text-fg" : "border-line text-fg-muted line-through decoration-1",
      )}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: on ? color : "transparent", border: `1.5px solid ${color}` }} />
      {children}
    </button>
  );
}
