/**
 * Part A analyses on a whole project: round statistics, open-answer candidates, consensus, panel check,
 * weights (relations ۱–۵) and the design brief.
 */
import { bandStats, bandStatsByDomain, type BandStats } from '../delphi/bands';
import { candidateMinSupport, candidateSupport, canonical, meetsCandidateThreshold } from '../delphi/candidates';
import { consensusStatus, type ConsensusResult } from '../delphi/consensus';
import { panelMinimumCheck, type PanelCheck } from '../delphi/panel';
import { computeWeights, type WeightsResult } from '../delphi/weights';
import { sum } from '../stats';
import type { Allocation, Candidate, Id, OpenCoding, Parameter, Project } from '../types';
import { expertById, includedExperts, paramsOfRound, respondents } from './selectors';

// ---------------------------------------------------------------------------------------------
// Round statistics (overall and per domain)
// ---------------------------------------------------------------------------------------------

export interface ParamStats {
  param: Parameter;
  overall: BandStats;
  byDomain: Record<Id, BandStats>;
}

/** Statistics of every parameter of the round, from the round's respondents. */
export function roundStats(p: Project, round: 'r1' | 'r2'): ParamStats[] {
  const resp = respondents(p, round);
  return paramsOfRound(p, round).map((param) => {
    const rows = resp.map((e) => ({ domainId: e.domainId, value: p.responses[round][e.id]?.ratings[param.id] ?? null }));
    return {
      param,
      overall: bandStats(
        rows.map((r) => r.value),
        p.scale,
      ),
      byDomain: bandStatsByDomain(rows, p.domains, p.scale),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Open answers and candidate parameters (round 1)
// ---------------------------------------------------------------------------------------------

export interface OpenAnswer {
  key: string;
  expertId: Id;
  groupId: Id;
  text: string;
  coding: OpenCoding | undefined;
}

export const codingKey = (expertId: Id, groupId: Id): string => `${expertId}|${groupId}`;

/** Non-empty round-1 open answers of included experts, in expert then group order. */
export function openAnswers(p: Project): OpenAnswer[] {
  const out: OpenAnswer[] = [];
  for (const e of includedExperts(p)) {
    const r = p.responses.r1[e.id];
    if (!r) continue;
    for (const g of p.groups) {
      const text = (r.openTexts[g.id] ?? '').trim();
      if (!text) continue;
      const key = codingKey(e.id, g.id);
      out.push({ key, expertId: e.id, groupId: g.id, text, coding: p.codings[key] });
    }
  }
  return out;
}

export interface CandidateRow {
  candidate: Candidate;
  /** The candidate this one counts towards after merges (itself if not merged). */
  canonicalId: Id;
  merged: boolean;
  /** Distinct supporting experts (for a canonical candidate: including merged synonyms). */
  supporters: Id[];
  minNeeded: number;
  meetsThreshold: boolean;
  /** Final decision: the 20 % rule unless overridden (DECISIONS D-14). */
  add: boolean;
  overridden: boolean;
}

export function candidateRows(p: Project): CandidateRow[] {
  const mergedInto = Object.fromEntries(p.candidates.map((c) => [c.id, c.mergedInto]));
  const codings = openAnswers(p).flatMap((a) =>
    (a.coding?.candidateIds ?? []).map((candidateId) => ({ expertId: a.expertId, candidateId })),
  );
  const support = candidateSupport(codings, mergedInto);
  const nResp = respondents(p, 'r1').length;
  const pct = p.settings.candidatePct;
  return p.candidates.map((candidate) => {
    const canonicalId = canonical(candidate.id, mergedInto);
    const merged = canonicalId !== candidate.id;
    const supporters = [...(support.get(canonicalId) ?? [])];
    const meetsThreshold = !merged && meetsCandidateThreshold(supporters.length, nResp, pct);
    const overridden = !merged && candidate.override !== null;
    const add = merged ? false : overridden ? candidate.override === 'add' : meetsThreshold;
    return { candidate, canonicalId, merged, supporters, minNeeded: candidateMinSupport(nResp, pct), meetsThreshold, add, overridden };
  });
}

// ---------------------------------------------------------------------------------------------
// Round 2: consensus, panel check
// ---------------------------------------------------------------------------------------------

export interface ConsensusRow extends ParamStats {
  consensus: ConsensusResult;
}

export function round2Analysis(p: Project): ConsensusRow[] {
  return roundStats(p, 'r2').map((s) => ({ ...s, consensus: consensusStatus(s.overall, p.settings.consensus) }));
}

export const retainedParamIds = (p: Project): Id[] =>
  round2Analysis(p)
    .filter((r) => r.consensus.status === 'retain')
    .map((r) => r.param.id);

export function panelCheck(p: Project): PanelCheck {
  return panelMinimumCheck(
    respondents(p, 'r2').map((e) => e.domainId),
    p.domains,
    { minTotal: p.settings.panel.minTotal, minPerDomain: p.settings.panel.minPerDomain },
  );
}

// ---------------------------------------------------------------------------------------------
// Allocation totals and weights
// ---------------------------------------------------------------------------------------------

export interface AllocationTotals {
  groupTotal: number;
  perGroup: Record<Id, number>;
}

/** Running totals of a point allocation (for the "≠ 100" warnings; never blocking). */
export function allocationTotals(p: Project, a: Allocation | null | undefined): AllocationTotals {
  const val = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const perGroup: Record<Id, number> = {};
  for (const g of p.groups) perGroup[g.id] = sum(p.params.filter((x) => x.groupId === g.id).map((x) => val(a?.paramPoints[x.id])));
  return { groupTotal: sum(p.groups.map((g) => val(a?.groupPoints[g.id]))), perGroup };
}

/** Relations ۱–۵ for the retained parameters, from the round-2 respondents' allocations. */
export function projectWeights(p: Project, retained: readonly Id[] = retainedParamIds(p)): WeightsResult {
  const experts = respondents(p, 'r2');
  return computeWeights({
    groups: p.groups,
    params: p.params,
    retained: new Set(retained),
    experts: experts.map((e) => ({ id: e.id, domainId: e.domainId })),
    domains: p.domains,
    allocations: experts
      .map((e) => p.responses.r2[e.id])
      .filter((r) => r?.allocation)
      .map((r) => ({ expertId: r.expertId, ...r.allocation! })),
  });
}

export interface BriefRow {
  param: Parameter;
  weight: number;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
}

/** Design brief (تفهیم‌نامه طراحی): retained parameters with Wᵢ and IQR, plus removed and no-consensus lists. */
export function designBrief(p: Project) {
  const analysis = round2Analysis(p);
  const w = projectWeights(p, analysis.filter((r) => r.consensus.status === 'retain').map((r) => r.param.id));
  const retained: BriefRow[] = w.retainedParams
    .map((id) => {
      const a = w.agreement[id];
      return { param: p.params.find((x) => x.id === id)!, weight: w.final[id], q1: a.q1, q3: a.q3, iqr: a.iqr };
    })
    .sort((a, b) => b.weight - a.weight);
  return {
    retained,
    removed: analysis.filter((r) => r.consensus.status === 'remove'),
    noConsensus: analysis.filter((r) => r.consensus.status === 'none'),
    weights: w,
  };
}

/** Experts of a domain below the configured minimum years (inclusion-criteria warning, DECISIONS P5). */
export function inclusionWarnings(p: Project): { expertId: Id; reason: 'below-min-years' | 'criteria-not-met' }[] {
  const out: { expertId: Id; reason: 'below-min-years' | 'criteria-not-met' }[] = [];
  for (const e of p.experts) {
    const d = p.domains.find((x) => x.id === e.domainId);
    if (d?.minYears != null && e.yearsExperience != null && e.yearsExperience < d.minYears)
      out.push({ expertId: e.id, reason: 'below-min-years' });
    if (e.inclusionMet === false) out.push({ expertId: e.id, reason: 'criteria-not-met' });
  }
  return out;
}

/** Display helper: the expert's code (outputs never use names). */
export const codeOf = (p: Project, expertId: Id): string => expertById(p, expertId)?.code ?? '?';
