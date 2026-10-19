/**
 * Sensitivity analysis on the weights (proposal «تحلیل حساسیت»):
 *   if the gap between the two best weighted scores is < 10 % of the scale range (0.4 on 1–5), each weight is
 *   increased by 20 % and decreased by 20 %, one at a time; the weights are renormalised to sum 1; relation ۸ is
 *   recomputed; and the results are reported.
 *
 * Break-even (build request; supplementary): for each parameter, the smallest change in its weight alone that
 * makes the second-placed concept tie with the first.
 */
import { EPS, sum } from '../stats';
import type { Id } from '../types';
import { rankDescending, weightedScore, type RankedConcept } from './weighted';

export const normalise = (w: readonly number[]): number[] => {
  const s = sum(w);
  return s > 0 ? w.map((x) => x / s) : w.map(() => 0);
};

export interface TriggerResult {
  gap: number;
  threshold: number;
  /** The proposal's condition: gap strictly less than the threshold. */
  triggered: boolean;
}

export function sensitivityTrigger(
  top1: number,
  top2: number,
  scale: { min: number; max: number },
  pctOfRange = 10,
): TriggerResult {
  const gap = top1 - top2;
  const threshold = (pctOfRange / 100) * (scale.max - scale.min); // 0.4 on 1–5
  return { gap, threshold, triggered: gap < threshold - EPS };
}

export interface Scenario {
  paramIndex: number;
  /** +0.2 = +20 %, −0.2 = −20 % */
  delta: number;
  weights: number[];
  ranking: RankedConcept[];
  /** The first-placed concept changed, or a tie for first appeared. */
  topChanged: boolean;
  /** Any change in the order or in the ranks. */
  rankingChanged: boolean;
}

/** One-at-a-time ±step on each weight, renormalised; the base is the normalised weights (DECISIONS D-46). */
export function oneAtATime(
  weights: readonly number[],
  aggregated: Readonly<Record<Id, readonly number[]>>,
  step = 0.2,
): { base: RankedConcept[]; scenarios: Scenario[] } {
  const baseW = normalise(weights);
  const order = (w: readonly number[]) =>
    rankDescending(Object.keys(aggregated).map((id) => ({ id, score: weightedScore(w, aggregated[id]) })));
  const base = order(baseW);
  const scenarios = baseW.flatMap((_, k) =>
    [step, -step].map((delta) => {
      const w = normalise(baseW.map((x, i) => (i === k ? x * (1 + delta) : x)));
      const ranking = order(w);
      return {
        paramIndex: k,
        delta,
        weights: w,
        ranking,
        topChanged: ranking[0]?.id !== base[0]?.id || ranking.filter((r) => r.rank === 1).length > 1,
        rankingChanged: ranking.some((r, i) => r.id !== base[i]?.id || r.rank !== base[i]?.rank),
      };
    }),
  );
  return { base, scenarios };
}

export interface BreakEven {
  /** Relative change of this weight (e.g. 1.333 = +133.3 %), or null if this weight cannot change the order. */
  delta: number | null;
  /** False when it would need a change below −100 % (a negative weight) or the weight cannot change the order. */
  possible: boolean;
}

/**
 * δ* = −D₀ / (w_k · d_k), where d = a − b (first minus second) and D₀ = Σ w_i d_i.
 * Scaling w_k by (1 + δ) and renormalising gives the gap (D₀ + w_k δ d_k) / (Σw + w_k δ), which is zero at δ*.
 */
export function breakEven(weights: readonly number[], a: readonly number[], b: readonly number[]): BreakEven[] {
  const d = a.map((ai, i) => ai - b[i]);
  const D0 = weights.reduce((s, w, i) => s + w * d[i], 0);
  return weights.map((wk, k) => {
    if (wk === 0 || Math.abs(d[k]) <= EPS) return { delta: null, possible: false };
    const delta = -D0 / (wk * d[k]);
    return { delta, possible: delta >= -1 };
  });
}
