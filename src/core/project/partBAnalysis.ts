/** Part B analyses on a whole project: the two screening runs, forwarding, the weighted matrix and sensitivity. */
import { bestOfRun, evaluateRun, forwardConcepts, majoritySymbol, type ForwardReason, type ForwardResult, type RunResult } from '../pugh/screening';
import { breakEven, normalise, oneAtATime, sensitivityTrigger, type BreakEven, type Scenario, type TriggerResult } from '../pugh/sensitivity';
import { weightedPugh, type RankedConcept, type WeightedResult } from '../pugh/weighted';
import { EPS, sum } from '../stats';
import type { Id, Project, PughSymbol, ScreeningRun } from '../types';
import { retainedParamIds } from './delphiAnalysis';
import { expertById, weightedRaterIds } from './selectors';

// ---------------------------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------------------------

export const screeningParamIds = (p: Project): Id[] => p.screening.paramIds ?? retainedParamIds(p);

/** Raters whose votes count: all raters in team mode, only the first in single-rater mode. */
const activeRaterIds = (p: Project): Id[] =>
  p.screening.mode === 'single' ? p.screening.raters.slice(0, 1).map((r) => r.id) : p.screening.raters.map((r) => r.id);

/** Majority symbol of a cell in a run. */
export function cellSymbol(p: Project, run: ScreeningRun, conceptId: Id, paramId: Id): PughSymbol | null {
  return majoritySymbol(activeRaterIds(p).map((r) => run.votes[r]?.[conceptId]?.[paramId] ?? null));
}

export interface FinalForward {
  conceptId: Id;
  forward: boolean;
  ruleReason: ForwardReason | 'eliminated-run1' | 'not-in-run2';
  /** Present when the researcher overrode the rule (DECISIONS D-41). */
  override: { forward: boolean; reason: string } | null;
}

export interface ScreeningAnalysis {
  paramIds: Id[];
  run1: RunResult | null;
  /** Concepts tied for the best net score in run 1. */
  bestTied: Id[];
  best: Id | null;
  run2: RunResult | null;
  /** Run 2 uses the run-1 votes because the run-1 datum is also the best (DECISIONS D-40). */
  run2UsesRun1Votes: boolean;
  /** Run-2 votes were entered against a different datum than the current best (warn). */
  run2DatumMismatch: boolean;
  forward: ForwardResult | null;
  final: FinalForward[];
  /** Concepts going to the weighted matrix after overrides. */
  forwarded: Id[];
  incompleteCells: { run: 1 | 2; count: number }[];
}

export function screeningAnalysis(p: Project): ScreeningAnalysis {
  const paramIds = screeningParamIds(p);
  const order = p.concepts.map((c) => c.id);
  const empty: ScreeningAnalysis = {
    paramIds,
    run1: null,
    bestTied: [],
    best: null,
    run2: null,
    run2UsesRun1Votes: false,
    run2DatumMismatch: false,
    forward: null,
    final: [],
    forwarded: [],
    incompleteCells: [],
  };
  const datum1 = p.screening.run1.datumId;
  if (!datum1 || !order.includes(datum1) || paramIds.length === 0) return empty;

  const run1 = evaluateRun({
    datumId: datum1,
    compared: order.filter((c) => c !== datum1),
    paramIds,
    cell: (c, prm) => cellSymbol(p, p.screening.run1, c, prm),
  });
  const bestTied = bestOfRun(run1, order);
  const best = p.screening.run1.bestChoice && bestTied.includes(p.screening.run1.bestChoice) ? p.screening.run1.bestChoice : bestTied[0];

  const run2UsesRun1Votes = best === datum1;
  const run2Votes = run2UsesRun1Votes ? p.screening.run1 : p.screening.run2;
  const run2 = evaluateRun({
    datumId: best,
    compared: [...run1.survivors, datum1].filter((c) => c !== best),
    paramIds,
    cell: (c, prm) => cellSymbol(p, run2Votes, c, prm),
  });
  const run2HasVotes = Object.values(p.screening.run2.votes).some((byC) => Object.keys(byC).length > 0);
  const run2DatumMismatch =
    !run2UsesRun1Votes && run2HasVotes && p.screening.run2.datumId !== null && p.screening.run2.datumId !== best;

  const feasible = (c: Id) => p.concepts.find((x) => x.id === c)?.feasible ?? false;
  const forward = forwardConcepts(run2, feasible, order, p.settings.maxForward, p.settings.minForward, p.screening.cutoffChoice);

  const final: FinalForward[] = order.map((c) => {
    const ruleReason: FinalForward['ruleReason'] = run1.eliminated.includes(c)
      ? 'eliminated-run1'
      : forward.reason[c] ?? 'not-in-run2';
    const ov = p.screening.overrides[c] ?? null;
    const byRule = forward.forwarded.includes(c);
    return { conceptId: c, forward: ov ? ov.forward : byRule, ruleReason, override: ov };
  });
  const forwardedOrder = [...forward.forwarded, ...order.filter((c) => !forward.forwarded.includes(c))];
  const forwarded = forwardedOrder.filter((c) => final.find((f) => f.conceptId === c)!.forward);

  const countEmpty = (r: RunResult) => Object.values(r.totals).reduce((s, t) => s + t.empty, 0);
  const incompleteCells = [
    { run: 1 as const, count: countEmpty(run1) },
    { run: 2 as const, count: countEmpty(run2) },
  ].filter((x) => x.count > 0);

  return { paramIds, run1, bestTied, best, run2, run2UsesRun1Votes, run2DatumMismatch, forward, final, forwarded, incompleteCells };
}

// ---------------------------------------------------------------------------------------------
// Weighted matrix
// ---------------------------------------------------------------------------------------------

/** Pseudo rater/domain id used in single-rater mode. */
export const SINGLE = '__single';

export interface WeightedAnalysis {
  conceptIds: Id[];
  raters: { expertId: Id; domainId: Id }[];
  weightSum: number;
  weightsSumToOne: boolean;
  result: WeightedResult;
  sensitivity: {
    trigger: TriggerResult;
    /** Ran because the trigger was met or "always run" is on. */
    ran: boolean;
    /** Ran although the proposal's trigger was not met (labelled supplementary, DECISIONS C2). */
    supplementary: boolean;
    base: RankedConcept[];
    scenarios: Scenario[];
    breakEven: BreakEven[];
    pair: [Id, Id];
  } | null;
  /** Part A weights changed since the last "send to Part B" (DECISIONS D-51). */
  partAChanged: boolean;
}

export const weightedConceptIds = (p: Project): Id[] =>
  (p.weighted.conceptIds ?? screeningAnalysis(p).forwarded).filter((id) => p.concepts.some((c) => c.id === id));

export function weightedAnalysis(p: Project, partAWeights?: Record<Id, number>): WeightedAnalysis {
  const conceptIds = weightedConceptIds(p);
  const single = p.weighted.mode === 'single';
  const raters = single
    ? [{ expertId: SINGLE, domainId: SINGLE }]
    : weightedRaterIds(p).map((id) => ({ expertId: id, domainId: expertById(p, id)!.domainId }));
  const domains = single ? [{ id: SINGLE }] : p.domains;
  const columns = p.weighted.columns;
  const result = weightedPugh({
    conceptIds,
    columns,
    domains,
    raters,
    score: (e, c, prm) => {
      const v = p.weighted.scores[e]?.[c]?.[prm];
      return typeof v === 'number' ? v : null;
    },
  });
  const weightSum = sum(columns.map((c) => c.weight));

  let sensitivity: WeightedAnalysis['sensitivity'] = null;
  const ranked = result.ranking;
  if (ranked.length >= 2 && columns.length > 0) {
    const w = normalise(columns.map((c) => c.weight));
    const agg = Object.fromEntries(
      ranked.map((r) => [r.id, columns.map((col) => result.cells[r.id][col.paramId].aggregated as number)]),
    );
    // The trigger is evaluated on the normalised weights, like the scenarios.
    const scoreN = (id: Id) => w.reduce((s, wi, i) => s + wi * agg[id][i], 0);
    const sortedN = ranked.map((r) => ({ id: r.id, s: scoreN(r.id) })).sort((a, b) => b.s - a.s);
    const trigger = sensitivityTrigger(sortedN[0].s, sortedN[1].s, { min: 1, max: 5 }, p.settings.sensitivity.pctOfRange);
    const ran = trigger.triggered || p.settings.sensitivity.alwaysRun;
    const oat = oneAtATime(w, agg, p.settings.sensitivity.step);
    sensitivity = {
      trigger,
      ran,
      supplementary: ran && !trigger.triggered,
      base: oat.base,
      scenarios: ran ? oat.scenarios : [],
      breakEven: breakEven(w, agg[sortedN[0].id], agg[sortedN[1].id]),
      pair: [sortedN[0].id, sortedN[1].id],
    };
  }

  const sent = p.weighted.sentWeights?.weights;
  const partAChanged =
    !!sent &&
    !!partAWeights &&
    (Object.keys(sent).length !== Object.keys(partAWeights).length ||
      Object.entries(partAWeights).some(([k, v]) => !(k in sent) || Math.abs(sent[k] - v) > EPS));

  return {
    conceptIds,
    raters,
    weightSum,
    weightsSumToOne: Math.abs(weightSum - 1) <= EPS,
    result,
    sensitivity,
    partAChanged,
  };
}
