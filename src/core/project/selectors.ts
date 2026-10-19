/**
 * Basic derived views of a project: who is included, which parameters belong to which round, who responded.
 * Pure functions; every screen and export reads the project through these.
 */
import { isAnswered } from '../scale';
import type { DelphiResponse, Expert, Id, Parameter, Project } from '../types';

/** Experts whose data may be analysed (not "withdrew and objected", DECISIONS P2). */
export const includedExperts = (p: Project): Expert[] => p.experts.filter((e) => !e.excludeAllData);

export const expertById = (p: Project, id: Id): Expert | undefined => p.experts.find((e) => e.id === id);

/** Parameters in display order: by semantic group order, then by their order in the list. */
export function orderedParams(p: Project, list: readonly Parameter[] = p.params): Parameter[] {
  const gIndex = new Map(p.groups.map((g, i) => [g.id, i]));
  const pIndex = new Map(p.params.map((x, i) => [x.id, i]));
  return [...list].sort(
    (a, b) => (gIndex.get(a.groupId) ?? 1e9) - (gIndex.get(b.groupId) ?? 1e9) || pIndex.get(a.id)! - pIndex.get(b.id)!,
  );
}

/** Round 1 rates the Phase-1 list only. */
export const round1Params = (p: Project): Parameter[] => orderedParams(p, p.params.filter((x) => x.origin === 'initial'));

/** Round 2 rates every parameter: the round-1 list plus the ones added from open answers. */
export const round2Params = (p: Project): Parameter[] => orderedParams(p, p.params);

export const paramsOfRound = (p: Project, round: 'r1' | 'r2'): Parameter[] =>
  round === 'r1' ? round1Params(p) : round2Params(p);

/** A response counts when it contains at least one answer (a rating or "cannot judge") (DECISIONS D-08). */
export const hasAnswers = (r: DelphiResponse | undefined, paramIds: readonly Id[]): boolean =>
  !!r && paramIds.some((id) => isAnswered(r.ratings[id]));

/** Included experts who responded in the round, in expert-list order. */
export function respondents(p: Project, round: 'r1' | 'r2'): Expert[] {
  const ids = paramsOfRound(p, round).map((x) => x.id);
  return includedExperts(p).filter((e) => hasAnswers(p.responses[round][e.id], ids));
}

const hasWithdrawn = (e: Expert): boolean =>
  e.status.r1.state === 'withdrew' || e.status.r2.state === 'withdrew' || e.status.pugh.state === 'withdrew';

/** Round-1 invitees: experts invited (status set) or with a stored response. */
export const r1Invitees = (p: Project): Id[] =>
  p.experts.filter((e) => e.status.r1.state !== 'none' || p.responses.r1[e.id]).map((e) => e.id);

/** Round-2 invitees: explicit list, or by default the round-1 respondents who have not withdrawn (DECISIONS D-19). */
export function r2Invitees(p: Project): Id[] {
  if (p.r2Invited) return p.r2Invited.filter((id) => p.experts.some((e) => e.id === id));
  return respondents(p, 'r1')
    .filter((e) => e.active && !hasWithdrawn(e))
    .map((e) => e.id);
}

/** Weighted-Pugh raters: explicit list, or by default the round-2 respondents (DECISIONS D-42). */
export function weightedRaterIds(p: Project): Id[] {
  const included = new Set(includedExperts(p).map((e) => e.id));
  if (p.weighted.raterIds) return p.weighted.raterIds.filter((id) => included.has(id));
  return respondents(p, 'r2').map((e) => e.id);
}

/** True once the first round-1 response exists: from then on edits are logged (DECISIONS D-55). */
export const dataCollectionStarted = (p: Project): boolean => Object.keys(p.responses.r1).length > 0;
