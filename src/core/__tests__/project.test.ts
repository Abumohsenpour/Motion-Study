/**
 * Whole-project analyses: the same hand-calculated fixtures, reached through a project object
 * (respondents, withdrawal rule, round-2 consensus feeding the weights, screening runs, weighted matrix).
 */
import { describe, expect, it } from 'vitest';
import { buildProject } from './fixtures';
import { candidateRows, designBrief, panelCheck, projectWeights, round2Analysis, roundStats } from '../project/delphiAnalysis';
import { screeningAnalysis, weightedAnalysis } from '../project/partBAnalysis';
import { panelDescription, responseRates } from '../project/descriptives';
import { r2Invitees, respondents } from '../project/selectors';
import type { Project } from '../types';

describe('project: Part A', () => {
  it('round statistics come from the respondents only', () => {
    const p = buildProject();
    const st = roundStats(p, 'r1');
    const p6 = st.find((s) => s.param.id === 'p6')!;
    // p6 round 1: 5, 9, 2, CJ, 7 → valid n = 4, low {2}, mid {5}, high {9, 7}
    expect(p6.overall).toMatchObject({ n: 4, nCannotJudge: 1, counts: [1, 1, 2] });
  });

  it('candidates: merged synonyms count towards the canonical candidate; 20 % of 5 respondents = 1 expert', () => {
    const rows = candidateRows(buildProject());
    const c1 = rows.find((r) => r.candidate.id === 'c1')!;
    expect(c1.supporters.sort()).toEqual(['E1', 'E3']);
    expect(c1).toMatchObject({ minNeeded: 1, meetsThreshold: true, add: true });
    expect(rows.find((r) => r.candidate.id === 'c2')).toMatchObject({ merged: true, add: false });
  });

  it('a manual override of the 20 % rule wins and is marked', () => {
    const p = buildProject();
    p.candidates[0].override = 'reject';
    expect(candidateRows(p)[0]).toMatchObject({ add: false, overridden: true });
  });

  it('round-2 consensus, panel check, and weights equal fixture F2', () => {
    const p = buildProject();
    const status = Object.fromEntries(round2Analysis(p).map((r) => [r.param.id, r.consensus.status]));
    expect(status).toEqual({ p1: 'retain', p2: 'retain', p3: 'remove', p4: 'retain', p5: 'retain', p6: 'none' });
    expect(panelCheck(p)).toMatchObject({ total: 5, totalOk: false, ok: false });
    const w = projectWeights(p);
    expect(w.excluded).toEqual([{ expertId: 'E5', reason: 'no-allocation' }]);
    expect(w.final.p1).toBeCloseTo(0.659375 / 3, 12);
    expect(w.final.p5).toBeCloseTo(0.31875, 12);
    const brief = designBrief(p);
    expect(brief.retained.map((r) => r.param.id)).toEqual(['p5', 'p4', 'p1', 'p2']); // by Wᵢ descending
    expect(brief.removed.map((r) => r.param.id)).toEqual(['p3']);
    expect(brief.noConsensus.map((r) => r.param.id)).toEqual(['p6']);
  });

  it('withdrawal with objection removes all of the expert’s data (DECISIONS P2)', () => {
    const p = buildProject();
    p.experts.find((e) => e.id === 'E4')!.excludeAllData = true;
    expect(respondents(p, 'r2').map((e) => e.id)).toEqual(['E1', 'E2', 'E3', 'E5']);
    const w = projectWeights(p);
    expect(w.domainsMissing).toHaveLength(1); // ergonomics now has no allocator
    expect(w.checks.finalSum).toBeCloseTo(1, 12);
    expect(candidateRows(p)[0].supporters.sort()).toEqual(['E1', 'E3']);
  });

  it('round-2 invitees default to round-1 respondents who have not withdrawn', () => {
    const p = buildProject();
    p.experts[1].status.r2 = { state: 'withdrew', date: '2026-11-10' };
    expect(r2Invitees(p)).toEqual(['E1', 'E3', 'E4', 'E5']);
    p.r2Invited = ['E1', 'E2'];
    expect(r2Invitees(p)).toEqual(['E1', 'E2']);
  });

  it('panel description and response rates', () => {
    const p = buildProject();
    const d = panelDescription(p);
    // years of round-1 respondents: 12, 7, 9, 15, 22 → sorted 7 9 12 15 22: median 12, Q1 9, Q3 15
    expect(d.overall.experience).toMatchObject({ n: 5, median: 12, q1: 9, q3: 15 });
    expect(d.overall.experienceBins).toEqual([0, 2, 1, 1, 1]); // <5, 5–9, 10–14, 15–19, ≥20
    const rr = responseRates(p);
    expect(rr.overall.r1).toEqual({ invited: 5, respondents: 5, rate: 1 });
    expect(rr.overall.r2).toEqual({ invited: 5, respondents: 5, rate: 1 });
    expect(rr.overall.attrition).toBe(0);
  });
});

describe('project: Part B', () => {
  function withConcepts(p: Project) {
    p.concepts = ['C1', 'C2', 'C3'].map((id) => ({ id, code: id, name: id, sketch: null, description: '', feasible: true }));
    p.screening.mode = 'single';
    p.screening.paramIds = ['p1', 'p2'];
    return p;
  }

  it('when the run-1 datum is the best, run 2 reuses the run-1 votes (DECISIONS D-40)', () => {
    const p = withConcepts(buildProject());
    const r = p.screening.raters[0].id;
    p.screening.run1.datumId = 'C1';
    p.screening.run1.votes = { [r]: { C2: { p1: '+', p2: '-' }, C3: { p1: '-', p2: '+' } } };
    // both nets 0 → tie with the datum (net 0): best = first in display order = C1
    const a = screeningAnalysis(p);
    expect(a.bestTied).toEqual(['C1', 'C2', 'C3']);
    expect(a.best).toBe('C1');
    expect(a.run2UsesRun1Votes).toBe(true);
    expect(a.forwarded).toEqual(['C1', 'C2', 'C3']);
  });

  it('a manual override changes the forwarded list and keeps the rule result visible', () => {
    const p = withConcepts(buildProject());
    const r = p.screening.raters[0].id;
    p.screening.run1.datumId = 'C1';
    p.screening.run1.votes = { [r]: { C2: { p1: '+', p2: '+' }, C3: { p1: '-', p2: 'S' } } };
    p.screening.run2.votes = { [r]: { C1: { p1: '-', p2: '-' } } };
    let a = screeningAnalysis(p);
    expect(a.run1!.eliminated).toEqual(['C3']);
    expect(a.best).toBe('C2');
    expect(a.forward!.bestDominatesAll).toBe(true);
    expect(a.forwarded).toEqual(['C2', 'C1']); // safety rule
    p.screening.overrides = { C3: { forward: true, reason: 'test' } };
    a = screeningAnalysis(p);
    expect(a.forwarded).toEqual(['C2', 'C1', 'C3']);
    expect(a.final.find((f) => f.conceptId === 'C3')).toMatchObject({ ruleReason: 'eliminated-run1', forward: true });
  });

  it('weighted analysis with the panel raters and the sensitivity block', () => {
    const p = withConcepts(buildProject());
    p.weighted.conceptIds = ['C1', 'C2'];
    p.weighted.columns = [
      { paramId: 'p1', weight: 0.6 },
      { paramId: 'p2', weight: 0.4 },
    ];
    // every rater gives C1 (4, 2) and C2 (3, 5)
    for (const e of ['E1', 'E2', 'E3', 'E4', 'E5'])
      p.weighted.scores[e] = { C1: { p1: 4, p2: 2 }, C2: { p1: 3, p2: 5 } };
    const a = weightedAnalysis(p, { p1: 0.6, p2: 0.4 });
    // C1 = 0.6·4 + 0.4·2 = 3.2 ; C2 = 0.6·3 + 0.4·5 = 3.8 → gap 0.6 ≥ 0.4 → not triggered, but "always run" is on
    expect(a.result.weighted.C1).toBeCloseTo(3.2, 12);
    expect(a.result.weighted.C2).toBeCloseTo(3.8, 12);
    expect(a.sensitivity).toMatchObject({ ran: true, supplementary: true, trigger: { triggered: false } });
    expect(a.raters).toHaveLength(5);
    expect(a.partAChanged).toBe(false);
    p.weighted.sentWeights = { at: 'x', weights: { p1: 0.5, p2: 0.5 } };
    expect(weightedAnalysis(p, { p1: 0.6, p2: 0.4 }).partAChanged).toBe(true);
  });
});
