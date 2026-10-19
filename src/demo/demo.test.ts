/**
 * The two sample projects.
 * - Worked example: must reproduce the hand-calculated values of SPEC.md § 6 (F1–F4) through the whole-project path.
 * - Full demo: 15 experts / 5 groups / 25 (+1) parameters / 5 concepts, with stable, sensible results.
 */
import { describe, expect, it } from 'vitest';
import {
  candidateRows,
  panelCheck,
  projectWeights,
  respondents,
  round2Analysis,
  screeningAnalysis,
  weightedAnalysis,
} from '../core';
import { buildDemoProject } from './demoProject';
import { buildWorkedExample } from './workedExample';

describe('worked example reproduces SPEC.md § 6', () => {
  const { project: p } = buildWorkedExample();

  it('F1: consensus of p1 (retain), p2 (retain at exactly 70 %), p3 (remove), p6 (no consensus)', () => {
    const a = Object.fromEntries(round2Analysis(p).map((r) => [r.param.id, r]));
    expect(a.p1.overall).toMatchObject({ n: 9, nCannotJudge: 1, counts: [1, 1, 7], median: 7, q1: 7, q3: 8 });
    expect(a.p2.overall).toMatchObject({ n: 10, counts: [1, 2, 7], median: 7, q1: 5.5, q3: 8 });
    expect(a.p3.overall).toMatchObject({ n: 8, nCannotJudge: 1, nMissing: 1, counts: [6, 1, 1], median: 2.5, q1: 1.75, q3: 3.25 });
    expect(a.p6.overall).toMatchObject({ n: 10, counts: [2, 1, 7], median: 9, q1: 5.25, q3: 9 });
    expect([a.p1, a.p2, a.p3, a.p4, a.p5, a.p6].map((r) => r.consensus.status)).toEqual(['retain', 'retain', 'remove', 'retain', 'retain', 'none']);
    expect(panelCheck(p).ok).toBe(true);
  });

  it('F2: weights W1 = 0.2198, W2 = 0.2177, W4 = 0.24375, W5 = 0.31875', () => {
    const w = projectWeights(p);
    expect(w.final.p1).toBeCloseTo(0.659375 / 3, 12);
    expect(w.final.p2).toBeCloseTo(0.653125 / 3, 12);
    expect(w.final.p4).toBeCloseTo(0.24375, 12);
    expect(w.final.p5).toBeCloseTo(0.31875, 12);
    expect(w.excluded.map((x) => x.expertId)).toEqual(['E5', 'E6', 'E7', 'E8', 'E9', 'E10']);
    expect(w.agreement.p1.iqr).toBeCloseTo(0.1046875, 12);
  });

  it('F4: screening runs and forwarding C4, C2, C1', () => {
    const s = screeningAnalysis(p);
    expect(s.run1!.eliminated).toEqual(['C3']);
    expect(s.best).toBe('C4');
    expect(s.run2!.eliminated).toEqual(['C5']);
    expect(s.forwarded).toEqual(['C4', 'C2', 'C1']);
    expect(s.run2DatumMismatch).toBe(false);
  });

  it('F3: weighted scores 3.3667 (C2), 3.6333 (C4), 3.3 (C1), sensitivity triggered, break-even +133.3 % / −57.1 %', () => {
    const a = weightedAnalysis(p);
    expect(a.result.weighted.C2).toBeCloseTo(3.3666667, 6);
    expect(a.result.weighted.C4).toBeCloseTo(3.6333333, 6);
    expect(a.result.weighted.C1).toBeCloseTo(3.3, 12);
    expect(a.result.ranking.map((x) => x.id)).toEqual(['C4', 'C2', 'C1']);
    expect(a.sensitivity!.trigger.triggered).toBe(true);
    expect(a.sensitivity!.breakEven[0].delta).toBeCloseTo(4 / 3, 9);
    expect(a.sensitivity!.breakEven[1].delta).toBeCloseTo(-4 / 7, 9);
    expect(a.sensitivity!.scenarios.filter((x) => x.rankingChanged).map((x) => [x.paramIndex, x.delta])).toEqual([
      [0, -0.2],
      [1, 0.2],
    ]);
  });

  it('F5-style candidate: 2 distinct experts of 10 respondents meet 20 %; overridden with a recorded reason', () => {
    const c = candidateRows(p).find((r) => r.candidate.id === 'c1')!;
    expect(c).toMatchObject({ meetsThreshold: true, overridden: true, add: false, minNeeded: 2 });
    expect(c.supporters.sort()).toEqual(['E1', 'E3']);
  });
});

describe('full demo project', () => {
  const { project: p, identities } = buildDemoProject();

  it('has the requested size', () => {
    expect(p.experts).toHaveLength(15);
    expect(p.groups).toHaveLength(5);
    expect(p.params.filter((x) => x.origin === 'initial')).toHaveLength(25);
    expect(p.params.filter((x) => x.origin === 'round2')).toHaveLength(1);
    expect(p.concepts).toHaveLength(5);
  });

  it('is deterministic', () => {
    const again = buildDemoProject().project;
    expect({ ...again, id: '' }).toEqual({ ...p, id: '' });
  });

  it('runs through the whole workflow with sensible results', () => {
    expect(respondents(p, 'r1')).toHaveLength(15);
    expect(respondents(p, 'r2')).toHaveLength(14); // E07 withdrew after round 1
    const status = Object.fromEntries(round2Analysis(p).map((r) => [r.param.code, r.consensus.status]));
    expect(status.P15).toBe('remove');
    expect(['P04', 'P09', 'P19'].map((c) => status[c])).toEqual(['none', 'none', 'none']);
    expect(Object.values(status).filter((s) => s === 'retain')).toHaveLength(22);
    const w = projectWeights(p);
    expect(w.excluded).toEqual([{ expertId: 'ex4', reason: 'no-allocation' }]);
    expect(w.checks.finalSumOk).toBe(true);
    expect(w.checks.expertSumsOk).toBe(true);
    expect(candidateRows(p).find((r) => r.candidate.id === 'cand1')).toMatchObject({ add: true });
    const s = screeningAnalysis(p);
    expect(s.run1!.eliminated).toEqual(['con3']);
    expect(s.forwarded).toEqual(['con4', 'con2', 'con5']);
    const a = weightedAnalysis(p, w.final);
    expect(a.weightsSumToOne).toBe(true);
    expect(a.partAChanged).toBe(false);
    expect(a.result.ranking.map((x) => x.id)).toEqual(['con4', 'con2', 'con5']);
    expect(a.sensitivity!.trigger.triggered).toBe(true);
  });

  it('keeps names out of the project data', () => {
    expect(Object.keys(identities)).toHaveLength(15);
    const json = JSON.stringify(p);
    for (const id of Object.values(identities)) {
      expect(json).not.toContain(id.name);
      expect(json).not.toContain(id.contact);
    }
  });
});
