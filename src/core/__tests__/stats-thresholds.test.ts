import { describe, expect, it } from 'vitest';
import { mean, median, quantile7, quartiles } from '../stats';
import { atLeastPct, atMostPct, maxCountAtMost, minCountAtLeast } from '../thresholds';

describe('quantile type 7 (= Excel QUARTILE.INC)', () => {
  it('matches the hand calculation for an even n with interpolation', () => {
    // sorted: 1 1 4 9 9 9 9 9 9 9 (n = 10, 0-based positions)
    // Q1: h = 9·0.25 = 2.25 → x[2] + 0.25·(x[3] − x[2]) = 4 + 0.25·5 = 5.25   (Excel QUARTILE.INC(...,1) = 5.25)
    // median: h = 4.5 → (x[4] + x[5]) / 2 = (9 + 9) / 2 = 9
    // Q3: h = 6.75 → 9 + 0.75·0 = 9
    expect(quartiles([9, 9, 9, 9, 9, 9, 9, 1, 1, 4])).toEqual({ n: 10, q1: 5.25, median: 9, q3: 9, iqr: 3.75 });
  });

  it('gives the mean of the two middle values as the median of an even n (relation ۶ wording)', () => {
    // sorted 1 1 2 2 3 3 4 8 → (2 + 3) / 2 = 2.5
    expect(median([1, 2, 3, 2, 1, 3, 4, 8])).toBe(2.5);
    expect(median([3, 4])).toBe(3.5);
  });

  it('handles n = 1 and n = 0', () => {
    expect(quartiles([4])).toEqual({ n: 1, q1: 4, median: 4, q3: 4, iqr: 0 });
    expect(quartiles([])).toEqual({ n: 0, q1: null, median: null, q3: null, iqr: null });
    expect(quantile7([], 0.5)).toBeNull();
    expect(mean([])).toBeNull();
  });

  it('does not depend on input order', () => {
    expect(quartiles([5, 1, 3])).toEqual(quartiles([1, 3, 5]));
    // n = 3: Q1 h = 0.5 → 1 + 0.5·2 = 2; Q3 h = 1.5 → 3 + 0.5·2 = 4
    expect(quartiles([5, 1, 3])).toMatchObject({ q1: 2, median: 3, q3: 4, iqr: 2 });
  });
});

describe('percentage thresholds with integer arithmetic', () => {
  it('decides exactly on the boundary', () => {
    // 7 of 10 = 70 %: 7·10000 = 70000 ≥ 7000·10 = 70000 → true
    expect(atLeastPct(7, 10, 70)).toBe(true);
    expect(atLeastPct(6, 10, 70)).toBe(false);
    // 3 of 20 = 15 %: 30000 ≤ 1500·20 = 30000 → true
    expect(atMostPct(3, 20, 15)).toBe(true);
    expect(atMostPct(4, 20, 15)).toBe(false);
  });

  it('never decides with n = 0', () => {
    expect(atLeastPct(0, 0, 70)).toBe(false);
    expect(atMostPct(0, 0, 15)).toBe(false);
  });

  it('agrees with exact rational comparison for every count up to n = 60 and odd thresholds', () => {
    for (const pct of [70, 15, 20, 66.67, 33.33, 12.5])
      for (let n = 1; n <= 60; n++)
        for (let c = 0; c <= n; c++) {
          // exact: c/n ≥ pct/100  ⇔  c·10000 ≥ pct·100·n with pct·100 an integer
          const bp = Math.round(pct * 100);
          expect(atLeastPct(c, n, pct)).toBe(c * 10000 >= bp * n);
          expect(atMostPct(c, n, pct)).toBe(c * 10000 <= bp * n);
        }
  });

  it('live helper: minimum top-band and maximum bottom-band counts for the default 70 / 15 %', () => {
    // n:            9  10  12  13  15  18
    // ⌈0.70·n⌉:     7   7   9  10  11  13
    // ⌊0.15·n⌋:     1   1   1   1   2   2
    const ns = [9, 10, 12, 13, 15, 18];
    expect(ns.map((n) => minCountAtLeast(n, 70))).toEqual([7, 7, 9, 10, 11, 13]);
    expect(ns.map((n) => maxCountAtMost(n, 15))).toEqual([1, 1, 1, 1, 2, 2]);
  });
});
