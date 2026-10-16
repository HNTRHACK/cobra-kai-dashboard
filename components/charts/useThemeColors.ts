"use client";

import { useEffect, useState } from "react";

const KEYS = ["bg", "panel", "fg", "fg-muted", "line", "grid", "accent", "accent-fill", "long", "short", "flat", "crash", "elevated", "s-original", "s-ridge", "s-selective", "s-v2"] as const;
export type ThemeColors = Record<(typeof KEYS)[number], string> & { mode: "light" | "dark" };

function read(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const out = { mode: document.documentElement.dataset.theme === "light" ? "light" : "dark" } as ThemeColors;
  for (const k of KEYS) (out as Record<string, string>)[k] = cs.getPropertyValue(`--${k}`).trim();
  return out;
}

/** Resolved CSS tokens for canvas charts (lightweight-charts can't read CSS variables). Re-reads on theme change. */
export function useThemeColors(): ThemeColors | null {
  const [c, setC] = useState<ThemeColors | null>(null);
  useEffect(() => {
    setC(read());
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => setC(read());
    mq.addEventListener("change", onMq);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", onMq);
    };
  }, []);
  return c;
}

/** CSS variable references for SVG (Recharts) marks — swap automatically with the theme. */
export const V = {
  fg: "var(--fg)",
  muted: "var(--fg-muted)",
  line: "var(--line)",
  grid: "var(--grid)",
  accent: "var(--accent)",
  accentFill: "var(--accent-fill)",
  long: "var(--long)",
  short: "var(--short)",
  flat: "var(--flat)",
  crash: "var(--crash)",
  elevated: "var(--elevated)",
  panel: "var(--panel)",
  original: "var(--s-original)",
  ridge: "var(--s-ridge)",
  selective: "var(--s-selective)",
  v2: "var(--s-v2)",
};
