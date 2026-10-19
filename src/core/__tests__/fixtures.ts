/** Shared test project: fixture F2's allocations and round-2 consensus, inside a whole project. */
import { createProject, newExpert } from '../project/defaults';
import type { Allocation, DelphiResponse, Project, RatingValue } from '../types';

export function buildProject(): Project {
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
