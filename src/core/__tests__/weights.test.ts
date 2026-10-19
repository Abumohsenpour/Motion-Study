/**
 * Fixture F2 (SPEC § 6): relations ۱–۵ by hand, plus the edge cases of the allocation.
 *
 * Groups: G1 = {p1, p2, p3}, G2 = {p4, p5}, G3 = {p6}
 * Round-2 consensus: retained p1, p2, p4, p5; removed p3; no consensus p6 → G3 has NO retained parameter.
 * Domains: S (surgery) = E1, E2, E5; M (engineering) = E3; A (ergonomics) = E4.
 */
import { describe, expect, it } from 'vitest';
import { computeWeights, type WeightsInput } from '../delphi/weights';

const groups = [{ id: 'G1' }, { id: 'G2' }, { id: 'G3' }];
const params = [
  { id: 'p1', groupId: 'G1' },
  { id: 'p2', groupId: 'G1' },
  { id: 'p3', groupId: 'G1' },
  { id: 'p4', groupId: 'G2' },
  { id: 'p5', groupId: 'G2' },
  { id: 'p6', groupId: 'G3' },
];
const retained = new Set(['p1', 'p2', 'p4', 'p5']);
const domains = [{ id: 'S' }, { id: 'M' }, { id: 'A' }];

const F2: WeightsInput = {
  groups,
  params,
  retained,
  domains,
  experts: [
    { id: 'E1', domainId: 'S' },
    { id: 'E2', domainId: 'S' },
    { id: 'E3', domainId: 'M' },
    { id: 'E4', domainId: 'A' },
    { id: 'E5', domainId: 'S' }, // skipped the allocation
  ],
  allocations: [
    { expertId: 'E1', groupPoints: { G1: 50, G2: 30, G3: 20 }, paramPoints: { p1: 60, p2: 20, p3: 20, p4: 50, p5: 50, p6: 100 } },
    { expertId: 'E2', groupPoints: { G1: 40, G2: 40, G3: 20 }, paramPoints: { p1: 30, p2: 30, p3: 40, p4: 80, p5: 20, p6: 100 } },
    { expertId: 'E3', groupPoints: { G1: 20, G2: 60, G3: 20 }, paramPoints: { p1: 10, p2: 40, p3: 50, p4: 25, p5: 75, p6: 100 } },
    // E4's totals are 90 (groups) and 80 (G2), not 100: relations ۱–۲ renormalise, so nothing changes.
    { expertId: 'E4', groupPoints: { G1: 30, G2: 30, G3: 30 }, paramPoints: { p1: 50, p2: 50, p3: 0, p4: 40, p5: 40, p6: 100 } },
  ],
};

describe('F2: relations ۱–۵ (hand-calculated)', () => {
  const r = computeWeights(F2);
  const e = (id: string) => r.perExpert.find((x) => x.expertId === id)!;

  it('relation ۲ uses only groups with a retained parameter (G3 left out)', () => {
    // E1: denominator = G1 + G2 = 50 + 30 = 80 → G1 = 50/80 = 0.625, G2 = 30/80 = 0.375
    expect(e('E1').groupWeight).toEqual({ G1: 0.625, G2: 0.375 });
    // E4: denominator = 30 + 30 = 60 → 0.5, 0.5
    expect(e('E4').groupWeight).toEqual({ G1: 0.5, G2: 0.5 });
    expect(r.retainedGroups).toEqual(['G1', 'G2']);
  });

  it('relation ۱ divides by the retained parameters of the group only (p3 left out)', () => {
    // E1, G1: 60 + 20 = 80 → p1 = 60/80 = 0.75, p2 = 20/80 = 0.25 ; G2: 50/100 = 0.5 each
    expect(e('E1').withinWeight).toEqual({ p1: 0.75, p2: 0.25, p4: 0.5, p5: 0.5 });
    // E3, G1: 10 + 40 = 50 → 0.2, 0.8 ; G2: 25/100, 75/100
    expect(e('E3').withinWeight).toEqual({ p1: 0.2, p2: 0.8, p4: 0.25, p5: 0.75 });
    // E4, G2: 40 + 40 = 80 → 0.5, 0.5
    expect(e('E4').withinWeight).toEqual({ p1: 0.5, p2: 0.5, p4: 0.5, p5: 0.5 });
  });

  it('relation ۳: overall = group × within, and each expert sums to 1', () => {
    // E1: p1 = 0.625·0.75 = 0.46875, p2 = 0.625·0.25 = 0.15625, p4 = p5 = 0.375·0.5 = 0.1875 → Σ = 1
    expect(e('E1').overall).toEqual({ p1: 0.46875, p2: 0.15625, p4: 0.1875, p5: 0.1875 });
    // E2: groups 40/80 = 0.5 each; G1 30/60 = 0.5 each; G2 0.8, 0.2 → 0.25, 0.25, 0.4, 0.1
    expect(e('E2').overall).toEqual({ p1: 0.25, p2: 0.25, p4: 0.4, p5: 0.1 });
    // E3: G1 0.25, G2 0.75 → 0.05, 0.2, 0.1875, 0.5625
    expect(e('E3').overall).toEqual({ p1: 0.05, p2: 0.2, p4: 0.1875, p5: 0.5625 });
    expect(e('E4').overall).toEqual({ p1: 0.25, p2: 0.25, p4: 0.25, p5: 0.25 });
    for (const x of r.perExpert) expect(x.sum).toBeCloseTo(1, 12);
    expect(r.checks.expertSumsOk).toBe(true);
  });

  it('the expert who skipped the allocation is excluded and listed', () => {
    expect(r.excluded).toEqual([{ expertId: 'E5', reason: 'no-allocation' }]);
    expect(r.perExpert.map((x) => x.expertId)).toEqual(['E1', 'E2', 'E3', 'E4']);
  });

  it('relation ۴: domain weight = mean of that domain’s experts', () => {
    // S = mean(E1, E2): p1 (0.46875 + 0.25)/2 = 0.359375 ; p2 (0.15625 + 0.25)/2 = 0.203125
    //                   p4 (0.1875 + 0.4)/2 = 0.29375  ; p5 (0.1875 + 0.1)/2 = 0.14375
    expect(r.domainWeights.S).toEqual({ p1: 0.359375, p2: 0.203125, p4: 0.29375, p5: 0.14375 });
    // single-expert domains equal that expert's weights
    expect(r.domainWeights.M).toEqual(e('E3').overall);
    expect(r.domainWeights.A).toEqual(e('E4').overall);
  });

  it('relation ۵: Wᵢ = mean of the domain weights, Σ = 1', () => {
    // W1 = (0.359375 + 0.05 + 0.25)/3 = 0.659375/3 = 0.21979166…
    // W2 = (0.203125 + 0.2 + 0.25)/3 = 0.653125/3 = 0.21770833…
    // W4 = (0.29375 + 0.1875 + 0.25)/3 = 0.73125/3 = 0.24375
    // W5 = (0.14375 + 0.5625 + 0.25)/3 = 0.95625/3 = 0.31875
    expect(r.final.p1).toBeCloseTo(0.659375 / 3, 12);
    expect(r.final.p2).toBeCloseTo(0.653125 / 3, 12);
    expect(r.final.p4).toBeCloseTo(0.24375, 12);
    expect(r.final.p5).toBeCloseTo(0.31875, 12);
    expect(r.checks.finalSum).toBeCloseTo(1, 12);
    expect(r.checks.finalSumOk).toBe(true);
    // Contrast: a one-stage mean over the 4 experts would give W1 = (0.46875 + 0.25 + 0.05 + 0.25)/4 = 0.2546875
    expect(r.final.p1).not.toBeCloseTo(0.2546875, 3);
  });

  it('reports the IQR of the individual overall weights as the agreement index', () => {
    // p1 individual weights sorted: 0.05, 0.25, 0.25, 0.46875 (n = 4)
    // Q1: h = 0.75 → 0.05 + 0.75·0.2 = 0.2 ; median: h = 1.5 → 0.25 ; Q3: h = 2.25 → 0.25 + 0.25·0.21875 = 0.3046875
    expect(r.agreement.p1.q1).toBeCloseTo(0.2, 12);
    expect(r.agreement.p1.median).toBeCloseTo(0.25, 12);
    expect(r.agreement.p1.q3).toBeCloseTo(0.3046875, 12);
    expect(r.agreement.p1.iqr).toBeCloseTo(0.1046875, 12);
  });

  it('renormalisation: totals that are not 100 give the same weights as the scaled-to-100 version', () => {
    const scaled = computeWeights({
      ...F2,
      experts: [{ id: 'E4', domainId: 'A' }],
      allocations: [
        { expertId: 'E4', groupPoints: { G1: 33.33, G2: 33.33, G3: 33.34 }, paramPoints: { p1: 50, p2: 50, p3: 0, p4: 50, p5: 50, p6: 100 } },
      ],
    });
    expect(scaled.perExpert[0].overall).toEqual({ p1: 0.25, p2: 0.25, p4: 0.25, p5: 0.25 });
  });
});

describe('allocation edge cases', () => {
  const base = { groups, params, retained, domains: [{ id: 'M' }] };

  it('D-22: an expert gives a group points but 0 to every retained parameter in it → the group is dropped for that expert', () => {
    // E6: G1 = 50, G2 = 50; within G1 only p3 (removed) got points → 0 ÷ 0 for p1, p2.
    // G1 is treated as having no retained parameter for E6: relation ۲ denominator = G2 = 50 → G2 weight 1.
    const r = computeWeights({
      ...base,
      experts: [{ id: 'E6', domainId: 'M' }],
      allocations: [{ expertId: 'E6', groupPoints: { G1: 50, G2: 50, G3: 0 }, paramPoints: { p1: 0, p2: 0, p3: 100, p4: 50, p5: 50, p6: 100 } }],
    });
    expect(r.perExpert[0]).toMatchObject({
      groupWeight: { G1: 0, G2: 1 },
      overall: { p1: 0, p2: 0, p4: 0.5, p5: 0.5 },
      sum: 1,
      droppedGroups: ['G1'],
    });
  });

  it('a group level left blank → excluded', () => {
    const r = computeWeights({
      ...base,
      experts: [{ id: 'E7', domainId: 'M' }],
      allocations: [{ expertId: 'E7', groupPoints: { G1: null, G2: null }, paramPoints: { p1: 50, p2: 50 } }],
    });
    expect(r.excluded).toEqual([{ expertId: 'E7', reason: 'group-level-blank' }]);
  });

  it('a blank parameter level inside a group that got points → excluded', () => {
    const r = computeWeights({
      ...base,
      experts: [{ id: 'E8', domainId: 'M' }],
      allocations: [{ expertId: 'E8', groupPoints: { G1: 50, G2: 50 }, paramPoints: { p4: 50, p5: 50 } }],
    });
    expect(r.excluded).toEqual([{ expertId: 'E8', reason: 'within-group-blank', groupId: 'G1' }]);
  });

  it('a blank parameter level inside a group with 0 points is fine (its weight is 0 anyway)', () => {
    const r = computeWeights({
      ...base,
      experts: [{ id: 'E9', domainId: 'M' }],
      allocations: [{ expertId: 'E9', groupPoints: { G1: 0, G2: 100 }, paramPoints: { p4: 30, p5: 70 } }],
    });
    expect(r.excluded).toEqual([]);
    expect(r.perExpert[0].overall).toEqual({ p1: 0, p2: 0, p4: 0.3, p5: 0.7 });
  });

  it('blanks next to entered numbers count as 0', () => {
    const r = computeWeights({
      ...base,
      experts: [{ id: 'E10', domainId: 'M' }],
      allocations: [{ expertId: 'E10', groupPoints: { G1: 100 }, paramPoints: { p1: 100 } }],
    });
    // G2 blank → 0; p2 blank → 0 → all weight on p1
    expect(r.perExpert[0].overall).toEqual({ p1: 1, p2: 0, p4: 0, p5: 0 });
  });

  it('all retained groups got 0 points → excluded', () => {
    const r = computeWeights({
      ...base,
      experts: [{ id: 'E11', domainId: 'M' }],
      allocations: [{ expertId: 'E11', groupPoints: { G1: 0, G2: 0, G3: 100 }, paramPoints: { p6: 100 } }],
    });
    expect(r.excluded).toEqual([{ expertId: 'E11', reason: 'zero-retained-group-points' }]);
  });

  it('a domain with no valid allocator: relation ۵ averages the other domains and Σ stays 1', () => {
    const r = computeWeights({ ...F2, experts: F2.experts.filter((x) => x.id !== 'E4') });
    expect(r.domainsMissing).toEqual(['A']);
    expect(r.domainsUsed).toEqual(['S', 'M']);
    // W1 = (0.359375 + 0.05)/2 = 0.2046875
    expect(r.final.p1).toBeCloseTo(0.2046875, 12);
    expect(r.checks.finalSum).toBeCloseTo(1, 12);
  });

  it('no retained parameter → nothing to weight', () => {
    const r = computeWeights({ ...F2, retained: new Set() });
    expect(r.retainedParams).toEqual([]);
    expect(r.final).toEqual({});
  });
});
