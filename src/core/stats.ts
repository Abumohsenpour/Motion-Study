/**
 * Descriptive statistics used everywhere in the app.
 *
 * One quantile method is used for every median, quartile and IQR: Hyndman–Fan type 7,
 * which is what Excel's QUARTILE.INC / PERCENTILE.INC and R's default quantile() compute
 * (SPEC § 1.3, DECISIONS D-01). For an even n the type-7 median is the mean of the two middle
 * values, exactly as the proposal describes for relation ۶.
 */

/** Quantile p (0…1) by Hyndman–Fan type 7. Returns null for an empty list. */
export function quantile7(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const x = [...values].sort((a, b) => a - b);
  const h = (x.length - 1) * p; // 0-based position
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, x.length - 1);
  return x[lo] + (h - lo) * (x[hi] - x[lo]); // linear interpolation between neighbours
}

export interface Quartiles {
  n: number;
  q1: number | null;
  median: number | null;
  q3: number | null;
  /** Q3 − Q1 */
  iqr: number | null;
}

export function quartiles(values: readonly number[]): Quartiles {
  const q1 = quantile7(values, 0.25);
  const median = quantile7(values, 0.5);
  const q3 = quantile7(values, 0.75);
  return { n: values.length, q1, median, q3, iqr: q1 === null || q3 === null ? null : q3 - q1 };
}

export const median = (values: readonly number[]): number | null => quantile7(values, 0.5);

/** Arithmetic mean; null for an empty list. */
export const mean = (values: readonly number[]): number | null =>
  values.length ? values.reduce((s, x) => s + x, 0) / values.length : null;

export const sum = (values: readonly number[]): number => values.reduce((s, x) => s + x, 0);

/** Tolerance for "sums to 1" checks and for ties between computed scores (SPEC § 1.5). */
export const EPS = 1e-9;

export const nearlyEqual = (a: number, b: number, tol = EPS): boolean => Math.abs(a - b) <= tol;
