/**
 * Whole-project analyses: the same hand-calculated fixtures, reached through a project object
 * (respondents, withdrawal rule, round-2 consensus feeding the weights, screening runs, weighted matrix).
 */
import { describe, expect, it } from 'vitest';
import { createProject, newExpert } from '../project/defaults';
import { candidateRows, designBrief, panelCheck, projectWeights, round2Analysis, roundStats } from '../project/delphiAnalysis';
import { screeningAnalysis, weightedAnalysis } from '../project/partBAnalysis';
import { panelDescription, responseRates } from '../project/descriptives';
import { r2Invitees, respondents } from '../project/selectors';
import type { Allocation, DelphiResponse, Project, RatingValue } from '../types';

function buildProject(): Project {
  const p = createProject('آزمون');
  const [S, M, A] = p.domains.map((d) => d.id);
  p.groups = [
    { id: 'G1', name: 'گروه ۱' },
    { id: 'G2', name: 'گروه ۲' },
    { id: 'G3', name: 'گروه ۳' },
  ];
  p.params = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id, i) => ({
    id,
    code: id.toUpperCase(),
    name: `پارامتر ${i + 1}`,
    groupId: i < 3 ? 'G1' : i < 5 ? 'G2' : 'G3',
    requirement: '',
    explanation: '',
    range: '',
    source: 'literature',
    origin: 'initial',
  }));
  const mk = (id: string, code: string, domainId: string, years: number) => ({ ...newExpert(code, domainId), id, yearsExperience: years });
  p.experts = [mk('E1', 'E01', S, 12), mk('E2', 'E02', S, 7), mk('E3', 'E03', M, 9), mk('E4', 'E04', A, 15), mk('E5', 'E05', S, 22)];
  for (const e of p.experts) e.status.r1 = { state: 'responded', date: '2026-11-01' };

  const resp = (expertId: string, round: 'r1' | 'r2', ratings: RatingValue[], allocation: Allocation | null = null, openTexts = {}): DelphiResponse => ({
    expertId,
    round,
    ratings: Object.fromEntries(ratings.map((v, i) => [`p${i + 1}`, v])),
    openTexts,
    allocation,
    consent: { given: true, at: null },
    source: 'manual',
    receivedAt: '2026-11-01',
  });
  // Round 1 (all five respond; E1 and E3 propose the same new idea in G1, E4 in G2)
  p.responses.r1 = {
    E1: resp('E1', 'r1', [9, 8, 2, 7, 7, 5], null, { G1: 'تهویه' }),
    E2: resp('E2', 'r1', [8, 7, 3, 8, 6, 9]),
    E3: resp('E3', 'r1', [7, 9, 1, 9, 7, 2], null, { G1: 'تهویه و خنک‌سازی' }),
    E4: resp('E4', 'r1', [9, 7, 2, 7, 8, 'CJ'], null, { G2: 'وزن کل' }),
    E5: resp('E5', 'r1', [8, 8, 4, 7, 9, 7]),
  };
  p.candidates = [
    { id: 'c1', label: 'تهویه', mergedInto: null, override: null, overrideReason: '', paramId: null },
    { id: 'c2', label: 'خنک‌سازی', mergedInto: 'c1', override: null, overrideReason: '', paramId: null },
  ];
  p.codings = {
    'E1|G1': { key: 'E1|G1', candidateIds: ['c1'], paramIds: [], commentOnly: false, displayText: null, note: '' },
    'E3|G1': { key: 'E3|G1', candidateIds: ['c2'], paramIds: [], commentOnly: false, displayText: null, note: '' },
    'E4|G2': { key: 'E4|G2', candidateIds: [], paramIds: ['p4'], commentOnly: false, displayText: null, note: '' },
  };
  // Round 2: p1, p2, p4, p5 retained; p3 removed; p6 no consensus (5 respondents: ≥4 top and 0 bottom to retain)
  const alloc = (g: number[], pp: number[]): Allocation => ({
    groupPoints: { G1: g[0], G2: g[1], G3: g[2] },
    paramPoints: Object.fromEntries(pp.map((v, i) => [`p${i + 1}`, v])),
  });
  p.responses.r2 = {
    E1: resp('E1', 'r2', [9, 8, 1, 9, 8, 9], alloc([50, 30, 20], [60, 20, 20, 50, 50, 100])),
    E2: resp('E2', 'r2', [9, 7, 2, 8, 7, 9], alloc([40, 40, 20], [30, 30, 40, 80, 20, 100])),
    E3: resp('E3', 'r2', [8, 9, 1, 7, 9, 9], alloc([20, 60, 20], [10, 40, 50, 25, 75, 100])),
    E4: resp('E4', 'r2', [8, 8, 2, 8, 7, 5], alloc([30, 30, 30], [50, 50, 0, 40, 40, 100])),
    E5: resp('E5', 'r2', [7, 7, 3, 9, 8, 1]),
  };
  return p;
}

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
