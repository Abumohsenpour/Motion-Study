/**
 * "What will change?" preview for edits that touch data already entered (build request § 0.4, DECISIONS D-57).
 * The edit is applied to a copy, every dependent result is recomputed, and the differences are listed before the
 * researcher confirms.
 */
import { EPS } from '../stats';
import { isValidRating } from '../scale';
import { CJ, type Id, type Project } from '../types';
import { candidateRows, projectWeights, round2Analysis } from './delphiAnalysis';
import { screeningAnalysis, weightedAnalysis } from './partBAnalysis';
import { respondents } from './selectors';

export type Impact =
  | { kind: 'respondents'; round: 'r1' | 'r2'; from: number; to: number }
  | { kind: 'invalid-ratings'; round: 'r1' | 'r2'; from: number; to: number }
  | { kind: 'responses-removed'; round: 'r1' | 'r2'; count: number }
  | { kind: 'consensus'; paramId: Id; from: string; to: string }
  | { kind: 'weight'; paramId: Id; from: number | null; to: number | null }
  | { kind: 'candidate'; candidateId: Id; from: boolean; to: boolean }
  | { kind: 'forwarded'; from: Id[]; to: Id[] }
  | { kind: 'ranking'; from: Id[]; to: Id[] }
  | { kind: 'scores-removed'; count: number };

/** Ratings stored in the project that are no longer valid on the current scale (blank and CJ excluded). */
function invalidRatings(p: Project, round: 'r1' | 'r2'): number {
  let n = 0;
  for (const r of Object.values(p.responses[round]))
    for (const v of Object.values(r.ratings)) if (v !== null && v !== CJ && !isValidRating(v, p.scale)) n++;
  return n;
}

function countScores(p: Project): number {
  let n = 0;
  for (const byC of Object.values(p.weighted.scores))
    for (const byP of Object.values(byC)) for (const v of Object.values(byP)) if (typeof v === 'number') n++;
  return n;
}

const safe = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch {
    return fallback;
  }
};

export function describeImpact(prev: Project, next: Project): Impact[] {
  const out: Impact[] = [];
  for (const round of ['r1', 'r2'] as const) {
    const a = respondents(prev, round).length;
    const b = respondents(next, round).length;
    if (a !== b) out.push({ kind: 'respondents', round, from: a, to: b });
    const removed = Object.keys(prev.responses[round]).filter((k) => !(k in next.responses[round])).length;
    if (removed) out.push({ kind: 'responses-removed', round, count: removed });
    const ia = invalidRatings(prev, round);
    const ib = invalidRatings(next, round);
    if (ia !== ib) out.push({ kind: 'invalid-ratings', round, from: ia, to: ib });
  }

  const ca = new Map(candidateRows(prev).map((r) => [r.candidate.id, r.add]));
  for (const r of candidateRows(next))
    if (ca.has(r.candidate.id) && ca.get(r.candidate.id) !== r.add)
      out.push({ kind: 'candidate', candidateId: r.candidate.id, from: ca.get(r.candidate.id)!, to: r.add });

  const sa = new Map(safe(() => round2Analysis(prev), []).map((r) => [r.param.id, r.consensus.status as string]));
  for (const r of safe(() => round2Analysis(next), []))
    if (sa.has(r.param.id) && sa.get(r.param.id) !== r.consensus.status)
      out.push({ kind: 'consensus', paramId: r.param.id, from: sa.get(r.param.id)!, to: r.consensus.status });

  const wa = safe(() => projectWeights(prev).final, {} as Record<Id, number>);
  const wb = safe(() => projectWeights(next).final, {} as Record<Id, number>);
  for (const id of new Set([...Object.keys(wa), ...Object.keys(wb)])) {
    const x = wa[id] ?? null;
    const y = wb[id] ?? null;
    if (x === null || y === null ? x !== y : Math.abs(x - y) > 1e-6) out.push({ kind: 'weight', paramId: id, from: x, to: y });
  }

  const fa = safe(() => screeningAnalysis(prev).forwarded, []);
  const fb = safe(() => screeningAnalysis(next).forwarded, []);
  if (fa.join() !== fb.join()) out.push({ kind: 'forwarded', from: fa, to: fb });

  const ra = safe(() => weightedAnalysis(prev).result.ranking, []);
  const rb = safe(() => weightedAnalysis(next).result.ranking, []);
  const sameRanking =
    ra.length === rb.length && ra.every((x, i) => x.id === rb[i].id && x.rank === rb[i].rank && Math.abs(x.score - rb[i].score) <= EPS);
  if (!sameRanking) out.push({ kind: 'ranking', from: ra.map((x) => x.id), to: rb.map((x) => x.id) });

  const sc = countScores(prev) - countScores(next);
  if (sc > 0) out.push({ kind: 'scores-removed', count: sc });
  return out;
}
