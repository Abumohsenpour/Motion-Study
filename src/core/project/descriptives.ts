/**
 * Panel description and response rates (proposal و) ۲ الف), reported only in aggregate and as ranges.
 * The described panel is the round-1 respondents (DECISIONS D-10).
 */
import { attrition, binCounts, frequencies, responseRate } from '../delphi/descriptives';
import { quartiles, type Quartiles } from '../stats';
import type { Expert, Id, Project } from '../types';
import { r1Invitees, r2Invitees, respondents } from './selectors';

export interface GroupDescription {
  n: number;
  experience: Quartiles;
  experienceBins: number[];
  /** Experts without years of experience recorded. */
  experienceMissing: number;
  activity: { value: string; count: number }[];
}

function describe(experts: readonly Expert[], edges: readonly number[]): GroupDescription {
  const years = experts.map((e) => e.yearsExperience).filter((y): y is number => typeof y === 'number');
  return {
    n: experts.length,
    experience: quartiles(years),
    experienceBins: binCounts(years, edges),
    experienceMissing: experts.length - years.length,
    activity: frequencies(experts.map((e) => e.activityType.trim() || '—')),
  };
}

export function panelDescription(p: Project) {
  const panel = respondents(p, 'r1');
  const edges = p.settings.experienceEdges;
  return {
    overall: describe(panel, edges),
    byDomain: Object.fromEntries(p.domains.map((d) => [d.id, describe(panel.filter((e) => e.domainId === d.id), edges)])) as Record<
      Id,
      GroupDescription
    >,
    edges,
  };
}

export interface RateRow {
  invited: number;
  respondents: number;
  rate: number | null;
}

export function responseRates(p: Project) {
  const inv1 = new Set(r1Invitees(p));
  const inv2 = new Set(r2Invitees(p));
  const res1 = respondents(p, 'r1').map((e) => e.id);
  const res2 = respondents(p, 'r2').map((e) => e.id);
  const row = (invited: Set<Id>, resp: Id[], filter: (id: Id) => boolean): RateRow => {
    const i = [...invited].filter(filter).length;
    const r = resp.filter(filter).length;
    return { invited: i, respondents: r, rate: responseRate(r, i) };
  };
  const domainOf = new Map(p.experts.map((e) => [e.id, e.domainId]));
  const all = () => true;
  return {
    overall: {
      r1: row(inv1, res1, all),
      r2: row(inv2, res2, all),
      attrition: attrition(res1, res2),
    },
    byDomain: Object.fromEntries(
      p.domains.map((d) => {
        const f = (id: Id) => domainOf.get(id) === d.id;
        return [d.id, { r1: row(inv1, res1, f), r2: row(inv2, res2, f), attrition: attrition(res1.filter(f), res2.filter(f)) }];
      }),
    ) as Record<Id, { r1: RateRow; r2: RateRow; attrition: number | null }>,
  };
}
