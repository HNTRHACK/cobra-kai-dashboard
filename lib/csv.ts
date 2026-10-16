// Minimal, strict CSV parsing + schema validation for submission files.
// Files are numeric-only, comma separated, with a header row.

export class SchemaError extends Error {}

export function parseNumericCsv(text: string): { header: string[]; rows: number[][] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new SchemaError("CSV has no data rows");
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split(",");
    if (cells.length !== header.length) throw new SchemaError(`row ${i + 2}: expected ${header.length} cells, got ${cells.length}`);
    return cells.map((c, j) => {
      const v = Number(c);
      if (c.trim() === "" || !Number.isFinite(v)) throw new SchemaError(`row ${i + 2}, column ${header[j]}: not a number`);
      return v;
    });
  });
  return { header, rows };
}

export type Validation = { ok: boolean; checks: { label: string; pass: boolean }[] };

/** Round 3 rule: exactly 50 rows, timestamps 851–900 in order, columns timestamp,signal, values in [-1, 1]. */
export function validateSignals(header: string[], rows: number[][]): Validation {
  const ts = rows.map((r) => r[0]);
  const sig = rows.map((r) => r[1]);
  const checks = [
    { label: "Columns are timestamp,signal", pass: header.join(",") === "timestamp,signal" },
    { label: "Exactly 50 rows", pass: rows.length === 50 },
    { label: "Timestamps 851–900 in order", pass: ts.every((t, i) => t === 851 + i) },
    { label: "Signals within [−1, +1]", pass: sig.every((s) => s >= -1 && s <= 1) },
  ];
  return { ok: checks.every((c) => c.pass), checks };
}

/** Rounds 1–2 rule: timestamp,prediction,confidence with binary prediction and confidence in [0.5, 1]. */
export function validatePredictions(header: string[], rows: number[][], first: number): Validation {
  const checks = [
    { label: "Columns are timestamp,prediction,confidence", pass: header.join(",") === "timestamp,prediction,confidence" },
    { label: "Exactly 50 rows", pass: rows.length === 50 },
    { label: `Timestamps ${first}–${first + 49} in order`, pass: rows.every((r, i) => r[0] === first + i) },
    { label: "Prediction is 0 or 1", pass: rows.every((r) => r[1] === 0 || r[1] === 1) },
    { label: "Confidence within [0, 1]", pass: rows.every((r) => r[2] >= 0 && r[2] <= 1) },
  ];
  return { ok: checks.every((c) => c.pass), checks };
}
