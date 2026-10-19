/**
 * Weighted Pugh matrix, relations ۶–۸ (proposal «گام سوم - انتخاب نهایی با ماتریس پیو وزن‌دار»).
 *
 *   Relation ۶  domain score = median of that domain's experts for the concept and parameter
 *   Relation ۷  aggregated score = mean of the domain scores (the proposal's "÷ ۳", generalised to K domains)
 *   Relation ۸  weighted score = Σ (Wᵢ × aggregated score)
 *
 * Scoring is absolute on the 5-level value scale; there is no datum in this step.
 */
import { EPS, mean, median, quartiles, type Quartiles } from '../stats';
import type { Id } from '../types';

/** Relation ۶ (type-7 median: even n → mean of the two middle values). */
export const domainScore = (scores: readonly number[]): number | null => median(scores);

/** Relation ۷: mean over the domains that have a score for this cell (DECISIONS D-44). */
export const aggregatedScore = (domainScores: readonly (number | null)[]): number | null =>
  mean(domainScores.filter((x): x is number => x !== null));

/** Relation ۸ */
export const weightedScore = (weights: readonly number[], aggregated: readonly number[]): number =>
  weights.reduce((s, w, i) => s + w * aggregated[i], 0);

export interface WeightedInput {
  conceptIds: readonly Id[];
  columns: readonly { paramId: Id; weight: number }[];
  domains: readonly { id: Id }[];
  raters: readonly { expertId: Id; domainId: Id }[];
  /** 1–5, or null for a blank. */
  score: (expertId: Id, conceptId: Id, paramId: Id) => number | null;
}

export interface WeightedCell {
  /** Median and IQR per domain, reported as the agreement index. */
  byDomain: Record<Id, Quartiles>;
  /** Relation ۶ per domain (null = no score from that domain). */
  domainScore: Record<Id, number | null>;
  /** Relation ۷ (null = no score at all). */
  aggregated: number | null;
}

export interface RankedConcept {
  id: Id;
  score: number;
  /** Competition ranking (1, 1, 3). */
  rank: number;
}

export interface WeightedResult {
  cells: Record<Id, Record<Id, WeightedCell>>;
  /** Relation ۸; null when the concept's row is incomplete (DECISIONS D-44). */
  weighted: Record<Id, number | null>;
  ranking: RankedConcept[];
  incomplete: Id[];
}

export function weightedPugh(inp: WeightedInput): WeightedResult {
  const cells: Record<Id, Record<Id, WeightedCell>> = {};
  const weighted: Record<Id, number | null> = {};
  for (const c of inp.conceptIds) {
    cells[c] = {};
    for (const col of inp.columns) {
      const byDomain: Record<Id, Quartiles> = {};
      const ds: Record<Id, number | null> = {};
      for (const d of inp.domains) {
        const v = inp.raters
          .filter((r) => r.domainId === d.id)
          .map((r) => inp.score(r.expertId, c, col.paramId))
          .filter((x): x is number => typeof x === 'number');
        byDomain[d.id] = quartiles(v);
        ds[d.id] = domainScore(v);
      }
      cells[c][col.paramId] = { byDomain, domainScore: ds, aggregated: aggregatedScore(Object.values(ds)) };
    }
    const agg = inp.columns.map((col) => cells[c][col.paramId].aggregated);
    weighted[c] = agg.every((x) => x !== null)
      ? weightedScore(
          inp.columns.map((col) => col.weight),
          agg as number[],
        )
      : null;
  }
  return {
    cells,
    weighted,
    ranking: rankDescending(inp.conceptIds.map((id) => ({ id, score: weighted[id] }))),
    incomplete: inp.conceptIds.filter((id) => weighted[id] === null),
  };
}

/** Competition ranking (1, 1, 3) with tie tolerance; items with a null score are not ranked (DECISIONS D-45). */
export function rankDescending(items: readonly { id: Id; score: number | null }[], tol = EPS): RankedConcept[] {
  const scored = items
    .filter((x): x is { id: Id; score: number } => x.score !== null && Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => ({ ...x, rank: 1 + scored.filter((y) => y.score > x.score + tol).length }));
}
