/**
 * Percentage thresholds tested with integer arithmetic (SPEC § 1.4, DECISIONS D-04).
 *
 * "≥ 70 %" is never tested on a computed percentage; it is tested as count·100 ≥ 70·n.
 * Thresholds may carry up to two decimals (e.g. 66.67), so both sides are scaled by another 100:
 * count·10000 ≥ round(pct·100)·n. Floating-point rounding can therefore never flip a decision.
 */

/** 70 → 7000, 66.67 → 6667 (hundredths of a percent). */
const basisPoints = (pct: number): number => Math.round(pct * 100);

/** count / n ≥ pct %, exactly. False when n = 0. */
export const atLeastPct = (count: number, n: number, pct: number): boolean =>
  n > 0 && count * 10000 >= basisPoints(pct) * n;

/** count / n ≤ pct %, exactly. False when n = 0. */
export const atMostPct = (count: number, n: number, pct: number): boolean =>
  n > 0 && count * 10000 <= basisPoints(pct) * n;

/** Live helper: the smallest count that satisfies "≥ pct %" for this n. */
export const minCountAtLeast = (n: number, pct: number): number => Math.ceil((basisPoints(pct) * n) / 10000);

/** Live helper: the largest count that satisfies "≤ pct %" for this n. */
export const maxCountAtMost = (n: number, pct: number): number => Math.floor((basisPoints(pct) * n) / 10000);
