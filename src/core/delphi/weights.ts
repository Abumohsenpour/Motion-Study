/**
 * Final weights of the retained parameters from the hierarchical point allocation, relations ۱–۵
 * (proposal: «محاسبه وزن نهایی پارامترها»).
 *
 *   Relation ۱  within-group weight = expert's points for the parameter ÷ expert's points for the RETAINED
 *               parameters of the same group
 *   Relation ۲  group weight = expert's points for the group ÷ expert's points for the groups that have at
 *               least one retained parameter
 *   Relation ۳  overall weight (per expert) = group weight × within-group weight   (Σ over parameters = 1)
 *   Relation ۴  domain weight = mean of the overall weights of that domain's experts
 *   Relation ۵  Wᵢ = mean of the domain weights (the proposal's "÷ ۳", generalised to K domains)
 *
 * Wᵢ is reported with the IQR of the individual overall weights as the agreement index.
 * Experts who did not complete the allocation are excluded and listed (proposal و) ۲ د).
 */
import { EPS, mean, quartiles, sum, type Quartiles } from '../stats';
import type { Allocation, Id } from '../types';

export interface WeightsInput {
  groups: readonly { id: Id }[];
  params: readonly { id: Id; groupId: Id }[];
  /** Parameters with consensus status "retain". */
  retained: ReadonlySet<Id>;
  /** Round-2 respondents not excluded under the withdrawal rule. */
  experts: readonly { id: Id; domainId: Id }[];
  domains: readonly { id: Id }[];
  allocations: readonly ({ expertId: Id } & Allocation)[];
}

export type ExclusionReason = 'no-allocation' | 'group-level-blank' | 'within-group-blank' | 'zero-retained-group-points';

export interface Exclusion {
  expertId: Id;
  reason: ExclusionReason;
  groupId?: Id;
}

export interface ExpertWeights {
  expertId: Id;
  domainId: Id;
  /** Relation ۲, for groups with ≥ 1 retained parameter. */
  groupWeight: Record<Id, number>;
  /** Relation ۱, for retained parameters. */
  withinWeight: Record<Id, number>;
  /** Relation ۳. */
  overall: Record<Id, number>;
  /** Σ overall, which must be 1. */
  sum: number;
  /** Groups whose retained parameters all got 0 points from this expert although the group got points (DECISIONS D-22). */
  droppedGroups: Id[];
}

export interface WeightsResult {
  /** Groups that have at least one retained parameter, in input order. */
  retainedGroups: Id[];
  /** Retained parameters, grouped, in input order. */
  retainedParams: Id[];
  perExpert: ExpertWeights[];
  excluded: Exclusion[];
  /** Relation ۴; null for a domain without any included expert. */
  domainWeights: Record<Id, Record<Id, number> | null>;
  domainsUsed: Id[];
  domainsMissing: Id[];
  /** Relation ۵. */
  final: Record<Id, number>;
  /** Quartiles of the individual overall weights (all included experts pooled). */
  agreement: Record<Id, Quartiles>;
  checks: { expertSumsOk: boolean; finalSum: number; finalSumOk: boolean };
}

/** Points as used by the relations: blank, negative or non-numeric → 0. */
const pts = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** A level counts as "entered" if the expert typed at least one number in it (DECISIONS D-21). */
const anyEntered = (vals: readonly (number | null | undefined)[]): boolean =>
  vals.some((v) => typeof v === 'number' && Number.isFinite(v));

export function computeWeights(inp: WeightsInput): WeightsResult {
  // Retained parameters grouped by semantic group. Groups without any retained parameter are left out here,
  // which is exactly the denominator of relation ۲.
  const retainedByGroup = new Map<Id, Id[]>();
  for (const g of inp.groups) {
    const r = inp.params.filter((p) => p.groupId === g.id && inp.retained.has(p.id)).map((p) => p.id);
    if (r.length) retainedByGroup.set(g.id, r);
  }

  const perExpert: ExpertWeights[] = [];
  const excluded: Exclusion[] = [];

  for (const ex of inp.experts) {
    const a = inp.allocations.find((x) => x.expertId === ex.id);
    if (!a) {
      excluded.push({ expertId: ex.id, reason: 'no-allocation' });
      continue;
    }
    if (!anyEntered(inp.groups.map((g) => a.groupPoints[g.id]))) {
      excluded.push({ expertId: ex.id, reason: 'group-level-blank' });
      continue;
    }

    // Relation ۱
    const withinWeight: Record<Id, number> = {};
    const dropped: Id[] = [];
    let blankGroup: Id | null = null;
    for (const [g, retainedInGroup] of retainedByGroup) {
      const groupPts = pts(a.groupPoints[g]);
      const allInGroup = inp.params.filter((p) => p.groupId === g).map((p) => a.paramPoints[p.id]);
      if (groupPts > 0 && !anyEntered(allInGroup)) {
        blankGroup = g;
        break;
      }
      const denom = sum(retainedInGroup.map((p) => pts(a.paramPoints[p])));
      if (denom === 0) {
        // 0 ÷ 0: the expert gave nothing to any retained parameter of this group. If the group itself got
        // points, the group is treated as having no retained parameter for this expert (DECISIONS D-22).
        if (groupPts > 0) dropped.push(g);
        for (const p of retainedInGroup) withinWeight[p] = 0;
        continue;
      }
      for (const p of retainedInGroup) withinWeight[p] = pts(a.paramPoints[p]) / denom;
    }
    if (blankGroup) {
      excluded.push({ expertId: ex.id, reason: 'within-group-blank', groupId: blankGroup });
      continue;
    }

    // Relation ۲
    const usable = [...retainedByGroup.keys()].filter((g) => !dropped.includes(g));
    const denomG = sum(usable.map((g) => pts(a.groupPoints[g])));
    if (denomG === 0) {
      excluded.push({ expertId: ex.id, reason: 'zero-retained-group-points' });
      continue;
    }
    const groupWeight: Record<Id, number> = {};
    for (const g of retainedByGroup.keys()) groupWeight[g] = usable.includes(g) ? pts(a.groupPoints[g]) / denomG : 0;

    // Relation ۳
    const overall: Record<Id, number> = {};
    for (const [g, retainedInGroup] of retainedByGroup)
      for (const p of retainedInGroup) overall[p] = groupWeight[g] * withinWeight[p];

    perExpert.push({
      expertId: ex.id,
      domainId: ex.domainId,
      groupWeight,
      withinWeight,
      overall,
      sum: sum(Object.values(overall)),
      droppedGroups: dropped,
    });
  }

  const retainedParams = [...retainedByGroup.values()].flat();

  // Relation ۴
  const domainWeights: Record<Id, Record<Id, number> | null> = {};
  for (const d of inp.domains) {
    const ew = perExpert.filter((e) => e.domainId === d.id);
    domainWeights[d.id] = ew.length
      ? Object.fromEntries(retainedParams.map((p) => [p, mean(ew.map((e) => e.overall[p]))!]))
      : null;
  }

  // Relation ۵: mean over the domains that have at least one included expert (DECISIONS D-26, D-27)
  const domainsUsed = inp.domains.map((d) => d.id).filter((d) => domainWeights[d]);
  const final: Record<Id, number> = Object.fromEntries(
    retainedParams.map((p) => [p, domainsUsed.length ? mean(domainsUsed.map((d) => domainWeights[d]![p]))! : NaN]),
  );

  const agreement = Object.fromEntries(retainedParams.map((p) => [p, quartiles(perExpert.map((e) => e.overall[p]))]));
  const finalSum = sum(Object.values(final));

  return {
    retainedGroups: [...retainedByGroup.keys()],
    retainedParams,
    perExpert,
    excluded,
    domainWeights,
    domainsUsed,
    domainsMissing: inp.domains.map((d) => d.id).filter((d) => !domainWeights[d]),
    final,
    agreement,
    checks: {
      expertSumsOk: perExpert.every((e) => Math.abs(e.sum - 1) <= EPS),
      finalSum,
      finalSumOk: domainsUsed.length > 0 && Math.abs(finalSum - 1) <= EPS,
    },
  };
}
