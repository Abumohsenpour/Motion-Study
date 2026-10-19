/**
 * Personalised controlled feedback for round 2 (proposal: «در کنار هر پارامتر، توزیع امتیازهای پنل در سه‌طبقه
 * به تفکیک هر حوزه تخصصی و امتیاز خود فرد در دور اول نمایش داده می‌شود»). Aggregated by domain; the only
 * individual score included is the expert's own (ethics ۹–۴).
 */
import { bandStatsByDomain } from './bands';
import type { DelphiResponse, Domain, Expert, Id, Parameter, RatingScale, RatingValue } from '../types';

export interface FeedbackItem {
  paramId: Id;
  isNew: boolean;
  /** Per domain: valid n and % per band. Null for parameters added in round 2. */
  byDomain: Record<Id, { n: number; percents: (number | null)[] }> | null;
  /** The expert's own round-1 answer, or 'not-asked' for new parameters. */
  own: RatingValue | 'not-asked';
}

export function buildFeedback(
  expertId: Id,
  round2Params: readonly Parameter[],
  r1: readonly DelphiResponse[],
  experts: readonly Expert[],
  domains: readonly Domain[],
  s: RatingScale,
): FeedbackItem[] {
  const domainOf = new Map(experts.map((e) => [e.id, e.domainId]));
  const usable = r1.filter((r) => {
    const e = experts.find((x) => x.id === r.expertId);
    return e && !e.excludeAllData;
  });
  const own = r1.find((r) => r.expertId === expertId);
  return round2Params.map((p) => {
    if (p.origin === 'round2') return { paramId: p.id, isNew: true, byDomain: null, own: 'not-asked' as const };
    const rows = usable.map((r) => ({ domainId: domainOf.get(r.expertId)!, value: r.ratings[p.id] ?? null }));
    const st = bandStatsByDomain(rows, domains, s);
    return {
      paramId: p.id,
      isNew: false,
      own: own?.ratings[p.id] ?? null,
      byDomain: Object.fromEntries(Object.entries(st).map(([d, b]) => [d, { n: b.n, percents: b.percents }])),
    };
  });
}
