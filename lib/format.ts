export const NA = "Not available";

export function pct(x: number | null | undefined, digits = 2, signed = true) {
  if (x == null || !Number.isFinite(x)) return NA;
  const v = (x * 100).toFixed(digits);
  return `${signed && x > 0 ? "+" : ""}${v}%`;
}

export function fixed(x: number | null | undefined, digits = 3, signed = false) {
  if (x == null || !Number.isFinite(x)) return NA;
  return `${signed && x > 0 ? "+" : ""}${x.toFixed(digits)}`;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function direction(s: number): "Long" | "Short" | "Flat" {
  return s > 0 ? "Long" : s < 0 ? "Short" : "Flat";
}
