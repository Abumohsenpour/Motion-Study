/**
 * Fixture F3 (SPEC § 6): weighted Pugh matrix, relations ۶–۸, the sensitivity rule and the break-even figure.
 * W = (p1 0.6, p2 0.4). Surgery (S) has 3 raters (odd n), engineering (M) 2 (even n), ergonomics (A) 1.
 */
import { describe, expect, it } from 'vitest';
import { breakEven, normalise, oneAtATime, sensitivityTrigger } from '../pugh/sensitivity';
import { aggregatedScore, domainScore, rankDescending, weightedPugh, weightedScore } from '../pugh/weighted';

const scores: Record<string, Record<string, Record<string, number[]>>> = {
  K1: { p1: { S: [4, 5, 3], M: [3, 4], A: [4] }, p2: { S: [2, 3, 3], M: [2, 2], A: [3] } },
  K2: { p1: { S: [3, 3, 4], M: [4, 5], A: [3] }, p2: { S: [4, 4, 5], M: [4, 3], A: [4] } },
  K3: { p1: { S: [2, 2, 3], M: [2, 3], A: [2] }, p2: { S: [5, 4, 5], M: [5, 5], A: [5] } },
};
const raters = [
  { expertId: 's1', domainId: 'S' },
  { expertId: 's2', domainId: 'S' },
  { expertId: 's3', domainId: 'S' },
  { expertId: 'm1', domainId: 'M' },
  { expertId: 'm2', domainId: 'M' },
  { expertId: 'a1', domainId: 'A' },
];
const idx: Record<string, number> = { s1: 0, s2: 1, s3: 2, m1: 0, m2: 1, a1: 0 };
const dom = Object.fromEntries(raters.map((r) => [r.expertId, r.domainId]));
const input = {
  conceptIds: ['K1', 'K2', 'K3'],
  columns: [
    { paramId: 'p1', weight: 0.6 },
    { paramId: 'p2', weight: 0.4 },
  ],
  domains: [{ id: 'S' }, { id: 'M' }, { id: 'A' }],
  raters,
  score: (e: string, c: string, p: string) => scores[c][p][dom[e]][idx[e]] ?? null,
};

describe('F3: relations ۶–۸ (hand-calculated)', () => {
  const r = weightedPugh(input);

  it('relation ۶: domain score = median (odd, even and single n)', () => {
    // K1·p1: S 4 5 3 → 4 ; M 3 4 → (3+4)/2 = 3.5 ; A 4 → 4
    expect(r.cells.K1.p1.domainScore).toEqual({ S: 4, M: 3.5, A: 4 });
    // K2·p1: S 3 3 4 → 3 ; M 4 5 → 4.5 ; A 3
    expect(r.cells.K2.p1.domainScore).toEqual({ S: 3, M: 4.5, A: 3 });
    expect(domainScore([2, 3])).toBe(2.5);
  });

  it('relation ۷: aggregated = mean of the domain scores', () => {
    // K1·p1 (4 + 3.5 + 4)/3 = 11.5/3 ; K1·p2 (3 + 2 + 3)/3 = 8/3
    expect(r.cells.K1.p1.aggregated).toBeCloseTo(11.5 / 3, 12);
    expect(r.cells.K1.p2.aggregated).toBeCloseTo(8 / 3, 12);
    // K2: (3 + 4.5 + 3)/3 = 3.5 ; (4 + 3.5 + 4)/3 = 11.5/3
    expect(r.cells.K2.p1.aggregated).toBeCloseTo(3.5, 12);
    expect(r.cells.K2.p2.aggregated).toBeCloseTo(11.5 / 3, 12);
    // K3: (2 + 2.5 + 2)/3 = 6.5/3 ; (5 + 5 + 5)/3 = 5
    expect(r.cells.K3.p1.aggregated).toBeCloseTo(6.5 / 3, 12);
    expect(r.cells.K3.p2.aggregated).toBe(5);
    expect(aggregatedScore([4, null, 2])).toBe(3); // a domain without scores is skipped
  });

  it('relation ۸: weighted = Σ W·aggregated, and the ranking', () => {
    // K1 = 0.6·3.8333 + 0.4·2.6667 = 2.3 + 1.0667 = 3.3667
    // K2 = 0.6·3.5    + 0.4·3.8333 = 2.1 + 1.5333 = 3.6333
    // K3 = 0.6·2.1667 + 0.4·5      = 1.3 + 2.0    = 3.3
    expect(r.weighted.K1).toBeCloseTo(3.3666667, 6);
    expect(r.weighted.K2).toBeCloseTo(3.6333333, 6);
    expect(r.weighted.K3).toBeCloseTo(3.3, 12);
    expect(r.ranking.map((x) => [x.id, x.rank])).toEqual([
      ['K2', 1],
      ['K1', 2],
      ['K3', 3],
    ]);
    expect(weightedScore([0.5, 0.5], [2, 4])).toBe(3);
  });

  it('reports median and IQR per concept × parameter × domain', () => {
    // K1·p1: S 3 4 5 → median 4 (Q1 3.5, Q3 4.5, IQR 1); M 3 4 → 3.5 (3.25–3.75, 0.5); A 4 → 4 (IQR 0)
    expect(r.cells.K1.p1.byDomain.S).toEqual({ n: 3, q1: 3.5, median: 4, q3: 4.5, iqr: 1 });
    expect(r.cells.K1.p1.byDomain.M).toEqual({ n: 2, q1: 3.25, median: 3.5, q3: 3.75, iqr: 0.5 });
    expect(r.cells.K1.p1.byDomain.A).toEqual({ n: 1, q1: 4, median: 4, q3: 4, iqr: 0 });
  });

  it('a concept with a blank cell is incomplete and unranked', () => {
    const r2 = weightedPugh({ ...input, score: (e, c, p) => (c === 'K3' && p === 'p2' ? null : input.score(e, c, p)) });
    expect(r2.weighted.K3).toBeNull();
    expect(r2.incomplete).toEqual(['K3']);
    expect(r2.ranking.map((x) => x.id)).toEqual(['K2', 'K1']);
  });

  it('ties share a rank (competition ranking)', () => {
    expect(rankDescending([{ id: 'a', score: 3 }, { id: 'b', score: 3 + 1e-12 }, { id: 'c', score: 2 }]).map((x) => x.rank)).toEqual([1, 1, 3]);
  });
});

describe('F3: sensitivity rule and break-even (hand-calculated)', () => {
  const r = weightedPugh(input);
  const agg = Object.fromEntries(['K1', 'K2', 'K3'].map((k) => [k, ['p1', 'p2'].map((p) => r.cells[k][p].aggregated!)]));

  it('the proposal’s trigger: gap between the top two < 10 % of the 1–5 range (0.4)', () => {
    // gap = 3.6333 − 3.3667 = 0.2667 < 0.4 → triggered
    const t = sensitivityTrigger(r.weighted.K2!, r.weighted.K1!, { min: 1, max: 5 });
    expect(t.threshold).toBeCloseTo(0.4, 12);
    expect(t.gap).toBeCloseTo(0.2666667, 6);
    expect(t.triggered).toBe(true);
    expect(sensitivityTrigger(3.8, 3.4, { min: 1, max: 5 }).triggered).toBe(false); // exactly 0.4 is not "less than"
  });

  it('±20 % on each weight, renormalised, recomputed', () => {
    const { base, scenarios } = oneAtATime([0.6, 0.4], agg, 0.2);
    expect(base.map((x) => x.id)).toEqual(['K2', 'K1', 'K3']);
    const s = (k: number, d: number) => scenarios.find((x) => x.paramIndex === k && x.delta === d)!;
    // p1 +20 %: (0.72, 0.4)/1.12 = (0.6429, 0.3571) → K1 3.4167, K2 3.6190, K3 3.1786 → unchanged
    expect(s(0, 0.2).weights[0]).toBeCloseTo(0.72 / 1.12, 12);
    expect(s(0, 0.2).ranking.map((x) => x.id)).toEqual(['K2', 'K1', 'K3']);
    expect(s(0, 0.2).ranking.find((x) => x.id === 'K1')!.score).toBeCloseTo(3.4166667, 6);
    expect(s(0, 0.2)).toMatchObject({ topChanged: false, rankingChanged: false });
    // p1 −20 %: (0.48, 0.4)/0.88 → K1 3.3030, K2 3.6515, K3 3.4545 → K3 overtakes K1
    expect(s(0, -0.2).ranking.map((x) => x.id)).toEqual(['K2', 'K3', 'K1']);
    expect(s(0, -0.2).ranking.find((x) => x.id === 'K3')!.score).toBeCloseTo(3.4545455, 6);
    expect(s(0, -0.2)).toMatchObject({ topChanged: false, rankingChanged: true });
    // p2 +20 %: (0.6, 0.48)/1.08 → K1 3.3148, K2 3.6481, K3 3.4259 → changed
    expect(s(1, 0.2).ranking.map((x) => x.id)).toEqual(['K2', 'K3', 'K1']);
    // p2 −20 %: (0.6, 0.32)/0.92 → K1 3.4275, K2 3.6159, K3 3.1522 → unchanged
    expect(s(1, -0.2)).toMatchObject({ topChanged: false, rankingChanged: false });
  });

  it('break-even: the change in one weight that makes K1 tie with K2', () => {
    // d = K2 − K1 = (3.5 − 3.8333, 3.8333 − 2.6667) = (−0.3333, +1.1667); D₀ = 0.6·(−0.3333) + 0.4·1.1667 = 0.2667
    // p1: δ* = −0.2667 / (0.6·−0.3333) = +1.3333 (+133.3 %)   check: weights (1.4, 0.4) → K2 = K1 = 6.4333
    // p2: δ* = −0.2667 / (0.4·1.1667)  = −0.5714 (−57.1 %)    check: weights (0.6, 0.1714) → K2 = K1 = 2.7571
    const be = breakEven([0.6, 0.4], agg.K2, agg.K1);
    expect(be[0].delta).toBeCloseTo(4 / 3, 9);
    expect(be[1].delta).toBeCloseTo(-4 / 7, 9);
    expect(be.every((x) => x.possible)).toBe(true);
    const check = (w: number[]) => weightedScore(w, agg.K2) - weightedScore(w, agg.K1);
    expect(check([0.6 * (1 + be[0].delta!), 0.4])).toBeCloseTo(0, 12);
    expect(check([0.6, 0.4 * (1 + be[1].delta!)])).toBeCloseTo(0, 12);
  });

  it('break-even is impossible when it needs a negative weight or the concepts score equally', () => {
    // A leads on both parameters (d = 1, 1; D₀ = 1): δ* = −1/(0.5·1) = −2 → −200 %, which would need a negative weight
    expect(breakEven([0.5, 0.5], [4, 4], [3, 3])).toEqual([
      { delta: -2, possible: false },
      { delta: -2, possible: false },
    ]);
    // Equal on p1 (d = 0) → p1's weight cannot change the order; p2 needs −100 % (weight 0 gives a tie)
    expect(breakEven([0.5, 0.5], [3, 4], [3, 2])).toEqual([
      { delta: null, possible: false },
      { delta: -1, possible: true },
    ]);
  });

  it('normalise', () => {
    expect(normalise([2, 2])).toEqual([0.5, 0.5]);
    expect(normalise([0, 0])).toEqual([0, 0]);
  });
});
