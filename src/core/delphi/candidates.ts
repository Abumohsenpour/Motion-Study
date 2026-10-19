/**
 * New parameters from round-1 open answers (proposal: «پارامترهای پیشنهادی جدید که دست‌کم ۲۰% پاسخ‌دهندگان
 * آن‌ها را مطرح کرده باشند، پس از تجمیع موارد هم‌معنا توسط تیم پژوهش، به فهرست دور دوم افزوده می‌شوند»).
 *
 * Support = number of DISTINCT experts behind a candidate after synonym merges.
 * Denominator = number of round-1 respondents (not only those who wrote open text).
 */
import { atLeastPct, minCountAtLeast } from '../thresholds';
import type { Id } from '../types';

export interface Coding {
  expertId: Id;
  candidateId: Id;
}

/** Follows merge links (candidate → the candidate it was merged into) to the surviving candidate. Cycle-safe. */
export function canonical(id: Id, mergedInto: Readonly<Record<Id, Id | null | undefined>>): Id {
  const seen = new Set<Id>();
  while (mergedInto[id] && !seen.has(id)) {
    seen.add(id);
    id = mergedInto[id]!;
  }
  return id;
}

/** canonical candidate → set of distinct experts supporting it */
export function candidateSupport(
  codings: readonly Coding[],
  mergedInto: Readonly<Record<Id, Id | null | undefined>>,
): Map<Id, Set<Id>> {
  const m = new Map<Id, Set<Id>>();
  for (const c of codings) {
    const k = canonical(c.candidateId, mergedInto);
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(c.expertId);
  }
  return m;
}

export const meetsCandidateThreshold = (distinctExperts: number, round1Respondents: number, pct = 20): boolean =>
  atLeastPct(distinctExperts, round1Respondents, pct);

/** Distinct experts needed for a candidate, e.g. 3 of 15 at 20 %. */
export const candidateMinSupport = (round1Respondents: number, pct = 20): number =>
  minCountAtLeast(round1Respondents, pct);
