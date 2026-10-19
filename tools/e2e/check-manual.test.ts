/**
 * Second half of the manual-entry test (see README.md here). The project file saved by manual-entry.cjs, whose
 * every value was typed through the app's screens, must hold exactly the data of the worked example
 * (src/demo/workedExample.ts = SPEC.md § 6) and give exactly the hand-calculated results.
 * Items are matched by their order and codes, because the ids the app gives them are random.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProjectJson, projectWeights, round2Analysis, screeningAnalysis, weightedAnalysis, type Allocation, type Id, type Project } from '../../src/core';
import { buildWorkedExample } from '../../src/demo/workedExample';

const file = process.env.MANUAL_PROJECT ?? 'tools/e2e/work/manual-project.json';
const { project: typed, problem } = parseProjectJson(readFileSync(file, 'utf8'));
const ref = buildWorkedExample().project;

/** The project's data in a form that does not depend on internal ids: experts by code, the rest by position. */
function view(p: Project) {
  const param = (id: Id) => p.params.findIndex((x) => x.id === id);
  const group = (id: Id) => p.groups.findIndex((g) => g.id === id);
  const expert = (id: Id) => p.experts.find((e) => e.id === id)!.code;
  const concept = (id: Id) => p.concepts.findIndex((c) => c.id === id);
  const rater = (id: Id) => p.screening.raters.findIndex((r) => r.id === id);
  const byIndex = <T,>(rec: Record<Id, T>, key: (id: Id) => number | string) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [key(k), v]));
  // an allocation with no number at all is the same as no allocation
  const alloc = (a: Allocation | null) =>
    a && Object.values(a.groupPoints).some((v) => v != null) ? { groups: byIndex(a.groupPoints, group), params: byIndex(a.paramPoints, param) } : null;
  const responses = (round: 'r1' | 'r2') =>
    Object.fromEntries(
      Object.values(p.responses[round]).map((r) => [
        expert(r.expertId),
        {
          ratings: Object.fromEntries(Object.entries(r.ratings).filter(([, v]) => v !== null).map(([k, v]) => [param(k), v])),
          openTexts: byIndex(Object.fromEntries(Object.entries(r.openTexts).filter(([, t]) => t.trim())), group),
          allocation: round === 'r2' ? alloc(r.allocation) : null,
        },
      ]),
    );
  const votes = (run: 'run1' | 'run2') =>
    Object.fromEntries(
      Object.entries(p.screening[run].votes).map(([r, byC]) => [
        rater(r),
        Object.fromEntries(Object.entries(byC).map(([c, byP]) => [concept(c), Object.fromEntries(Object.entries(byP).filter(([, v]) => v).map(([k, v]) => [param(k), v]))])),
      ]),
    );
  return {
    domains: p.domains.map((d) => d.name),
    experts: p.experts.map((e) => ({ code: e.code, domain: p.domains.findIndex((d) => d.id === e.domainId), years: e.yearsExperience, activity: e.activityType })),
    groups: p.groups.length,
    params: p.params.map((x) => ({ name: x.name, group: group(x.groupId), requirement: x.requirement, origin: x.origin })),
    r1: responses('r1'),
    r2: responses('r2'),
    concepts: p.concepts.map((c) => ({ name: c.name, feasible: c.feasible })),
    screeningRows: (p.screening.paramIds ?? null)?.map(param) ?? 'retained parameters',
    run1Datum: concept(p.screening.run1.datumId!),
    run1: votes('run1'),
    run2: votes('run2'),
    columns: p.weighted.columns.map((c) => ({ param: param(c.paramId), weight: c.weight })),
    weightedRaters: (p.weighted.raterIds ?? []).map(expert).sort(),
    weightedScores: Object.fromEntries(
      Object.entries(p.weighted.scores).map(([e, byC]) => [expert(e), Object.fromEntries(Object.entries(byC).map(([c, byP]) => [concept(c), byIndex(byP, param)]))]),
    ),
    settings: { scale: p.scale, consensus: p.settings.consensus, candidatePct: p.settings.candidatePct },
  };
}

describe('project typed by hand through the app', () => {
  it('opens without problems', () => {
    expect(problem).toBeNull();
    expect(typed).not.toBeNull();
  });

  it('holds exactly the data of the worked example', () => {
    const a = view(typed!);
    const b = view(ref);
    // the worked example names its screening rows explicitly; they are the retained parameters, the app's default
    b.screeningRows = 'retained parameters';
    expect(a).toEqual(b);
  });

  it('gives the hand-calculated results', () => {
    const p = typed!;
    const code = (id: Id) => p.params.find((x) => x.id === id)!.code;
    // F1: consensus
    expect(Object.fromEntries(round2Analysis(p).map((r) => [r.param.code, r.consensus.status]))).toEqual({
      P01: 'retain',
      P02: 'retain',
      P03: 'remove',
      P04: 'retain',
      P05: 'retain',
      P06: 'none',
    });
    // F2: final weights (exact fractions from SPEC.md)
    const w = projectWeights(p);
    const byCode = Object.fromEntries(Object.entries(w.final).map(([id, v]) => [code(id), v]));
    expect(byCode.P01).toBeCloseTo(0.659375 / 3, 12);
    expect(byCode.P02).toBeCloseTo(0.653125 / 3, 12);
    expect(byCode.P04).toBeCloseTo(0.24375, 12);
    expect(byCode.P05).toBeCloseTo(0.31875, 12);
    expect(w.excluded.map((x) => p.experts.find((e) => e.id === x.expertId)!.code).sort()).toEqual(['E05', 'E06', 'E07', 'E08', 'E09', 'E10']);
    // F4: screening
    const s = screeningAnalysis(p);
    const cc = (id: Id) => p.concepts.find((c) => c.id === id)!.code;
    expect(cc(s.best!)).toBe('C4');
    expect(s.forwarded.map(cc).sort()).toEqual(['C1', 'C2', 'C4']);
    // F3: weighted matrix and sensitivity
    const m = weightedAnalysis(p);
    const ws = Object.fromEntries(Object.entries(m.result.weighted).map(([id, v]) => [cc(id), v]));
    expect(ws.C2).toBeCloseTo(101 / 30, 12);
    expect(ws.C4).toBeCloseTo(109 / 30, 12);
    expect(ws.C1).toBeCloseTo(3.3, 12);
    expect(m.result.ranking.map((r) => cc(r.id))).toEqual(['C4', 'C2', 'C1']);
    expect(m.sensitivity!.trigger.triggered).toBe(true);
    expect(m.sensitivity!.breakEven[0].delta).toBeCloseTo(4 / 3, 12);
    expect(m.sensitivity!.breakEven[1].delta).toBeCloseTo(-4 / 7, 12);
  });
});
