/**
 * Fixture F1 (SPEC § 6): band percentages, descriptives and the consensus rule on round-2 answers.
 * Scale 1–9, bands 1–3 / 4–6 / 7–9, thresholds retain ≥70 % top & ≤15 % bottom, remove ≥70 % bottom & ≤15 % top.
 */
import { describe, expect, it } from 'vitest';
import { bandStats, bandStatsByDomain } from '../delphi/bands';
import { consensusHelper, consensusStatus, DEFAULT_THRESHOLDS, validateThresholds } from '../delphi/consensus';
import { defaultRatingScale, validateScale } from '../scale';
import { CJ, type RatingValue } from '../types';

const scale = defaultRatingScale();
const t = DEFAULT_THRESHOLDS;

describe('F1: bands and consensus (hand-calculated)', () => {
  it('P1 → retain; "cannot judge" is left out of n', () => {
    // answers 9 8 7 7 8 9 7 5 2 CJ → valid n = 9 (CJ excluded)
    // bands: low {2} = 1, mid {5} = 1, high {9,8,7,7,8,9,7} = 7
    // top 7/9 = 77.8 %: 7·100 = 700 ≥ 70·9 = 630 ✓ ; bottom 1/9 = 11.1 %: 100 ≤ 15·9 = 135 ✓ → retain
    // sorted 2 5 7 7 7 8 8 9 9: median h=4 → 7; Q1 h=2 → 7; Q3 h=6 → 8; IQR 1
    const s = bandStats([9, 8, 7, 7, 8, 9, 7, 5, 2, CJ], scale);
    expect(s).toMatchObject({ n: 9, nCannotJudge: 1, nMissing: 0, counts: [1, 1, 7], median: 7, q1: 7, q3: 8, iqr: 1 });
    expect(s.percents[2]).toBeCloseTo(77.7778, 4);
    expect(consensusStatus(s, t).status).toBe('retain');
  });

  it('P2 → remove; blank and CJ both excluded', () => {
    // answers 1 2 3 2 1 3 4 8 CJ (blank) → valid n = 8
    // low {1,2,3,2,1,3} = 6 → 75 %: 600 ≥ 560 ✓ ; high {8} = 1 → 12.5 %: 100 ≤ 120 ✓ → remove
    // sorted 1 1 2 2 3 3 4 8: median (2+3)/2 = 2.5; Q1 h=1.75 → 1 + 0.75·1 = 1.75; Q3 h=5.25 → 3 + 0.25·1 = 3.25
    const s = bandStats([1, 2, 3, 2, 1, 3, 4, 8, CJ, null], scale);
    expect(s).toMatchObject({ n: 8, nCannotJudge: 1, nMissing: 1, counts: [6, 1, 1], median: 2.5, q1: 1.75, q3: 3.25, iqr: 1.5 });
    expect(consensusStatus(s, t).status).toBe('remove');
  });

  it('P3 → no consensus: 70 % on top but 20 % at the bottom', () => {
    // n = 10: high 7 → 700 ≥ 700 ✓ ; low 2 → 200 ≤ 150 ✗ → retain fails; remove fails → «فاقد اجماع»
    const s = bandStats([9, 9, 9, 9, 9, 9, 9, 1, 1, 4], scale);
    expect(s).toMatchObject({ n: 10, counts: [2, 1, 7], median: 9, q1: 5.25, q3: 9, iqr: 3.75 });
    expect(consensusStatus(s, t)).toMatchObject({ status: 'none', retainMet: false, removeMet: false });
  });

  it('P4 → retain exactly on the 70 % boundary', () => {
    // n = 10: high 7 → 700 ≥ 700 ✓ ; low 1 → 100 ≤ 150 ✓
    const s = bandStats([9, 8, 7, 7, 8, 9, 7, 5, 2, 4], scale);
    expect(s).toMatchObject({ counts: [1, 2, 7], median: 7, q1: 5.5, q3: 8 });
    expect(consensusStatus(s, t).status).toBe('retain');
  });

  it('splits by domain', () => {
    // P1 with domains: S = 9 8 7 CJ, M = 7 8 9, A = 7 5 2
    const rows: { domainId: string; value: RatingValue }[] = [
      ...[9, 8, 7, CJ].map((value) => ({ domainId: 'S', value })),
      ...[7, 8, 9].map((value) => ({ domainId: 'M', value })),
      ...[7, 5, 2].map((value) => ({ domainId: 'A', value })),
    ];
    const by = bandStatsByDomain(rows, [{ id: 'S' }, { id: 'M' }, { id: 'A' }], scale);
    expect(by.S).toMatchObject({ n: 3, nCannotJudge: 1, counts: [0, 0, 3] });
    expect(by.M).toMatchObject({ n: 3, counts: [0, 0, 3] });
    expect(by.A).toMatchObject({ n: 3, counts: [1, 1, 1], median: 5 });
  });
});

describe('consensus edge cases', () => {
  it('n = 0 valid answers → no consensus, flagged', () => {
    const s = bandStats([CJ, null, CJ], scale);
    expect(s.n).toBe(0);
    expect(s.percents).toEqual([null, null, null]);
    expect(consensusStatus(s, t)).toMatchObject({ status: 'none', noValidAnswers: true });
  });

  it('thresholds edited so both rules hold → conflict, reported as no consensus', () => {
    const loose = { retainTopMin: 50, retainBottomMax: 50, removeBottomMin: 50, removeTopMax: 50 };
    expect(consensusStatus({ n: 10, counts: [5, 0, 5] }, loose)).toMatchObject({ status: 'none', conflict: true });
    expect(validateThresholds(loose)).toContain('overlap');
    expect(validateThresholds(t)).toEqual([]);
  });

  it('the live helper reports the counts needed for a given n', () => {
    expect(consensusHelper(15, t)).toEqual({ retainMinTop: 11, retainMaxBottom: 2, removeMinBottom: 11, removeMaxTop: 2 });
  });

  it('out-of-range answers after a scale edit count as missing', () => {
    const s = bandStats([10, 0, 5], scale);
    expect(s).toMatchObject({ n: 1, nMissing: 2 });
  });

  it('a configurable scale with four bands uses only the first and last band for consensus', () => {
    const s4 = {
      ...scale,
      min: 1,
      max: 7,
      bands: [
        { id: 'a', label: 'a', from: 1, to: 2 },
        { id: 'b', label: 'b', from: 3, to: 4 },
        { id: 'c', label: 'c', from: 5, to: 5 },
        { id: 'd', label: 'd', from: 6, to: 7 },
      ],
    };
    expect(validateScale(s4)).toEqual([]);
    const st = bandStats([6, 7, 7, 6, 6, 7, 7, 5, 3, 4], s4); // top 7/10, bottom 0
    expect(st.counts).toEqual([0, 2, 1, 7]);
    expect(consensusStatus(st, t).status).toBe('retain');
  });

  it('scale validation catches gaps, overlaps and missing coverage', () => {
    expect(validateScale(scale)).toEqual([]);
    const gap = { ...scale, bands: [{ id: 'x', label: '', from: 1, to: 4 }, { id: 'y', label: '', from: 6, to: 9 }] };
    expect(validateScale(gap)).toContainEqual({ band: 'y' });
    const short = { ...scale, bands: [{ id: 'x', label: '', from: 1, to: 4 }, { id: 'y', label: '', from: 5, to: 8 }] };
    expect(validateScale(short)).toContain('coverage');
  });
});
