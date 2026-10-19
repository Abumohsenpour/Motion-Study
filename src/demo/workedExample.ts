/**
 * "Worked example" project: the hand-calculated fixtures of SPEC.md § 6 assembled into one small project, so
 * every number on screen can be compared with the hand arithmetic (SPEC.md, src/core/__tests__ comments).
 *
 *   F1  round-2 answers of p1 (P1 retain), p2 (P4 retain on the 70 % boundary), p3 (P2 remove), p6 (P3 no consensus)
 *   F2  allocations of E01–E04 → W = 0.2198, 0.2177, 0.2438, 0.3188 (retained p1, p2, p4, p5); E05–E10 skipped
 *   F3  weighted matrix: W = (0.6, 0.4) typed by hand; raters 3 surgery, 2 engineering, 1 ergonomics
 *   F4  screening: 5 concepts, 4 parameters, 3 raters, two runs → C4, C2, C1 forwarded
 */
import { CJ, createProject, newExpert, type Allocation, type DelphiResponse, type ExpertIdentity, type Id, type Project, type PughSymbol, type RatingValue } from '../core';

export function buildWorkedExample(): { project: Project; identities: Record<Id, ExpertIdentity> } {
  const p = createProject('نمونه حل‌شده دستی (اعداد SPEC.md بخش ۶)');
  p.createdAt = p.updatedAt = '2026-10-19T08:00:00.000Z';
  p.domains = p.domains.map((d, i) => ({ ...d, id: ['S', 'M', 'A'][i] }));
  p.screening.raters = p.screening.raters.map((x, i) => ({ ...x, id: `rater${i + 1}` }));
  const [S, M, A] = p.domains.map((d) => d.id);
  p.groups = [
    { id: 'G1', name: 'گروه ۱ (G1)' },
    { id: 'G2', name: 'گروه ۲ (G2)' },
    { id: 'G3', name: 'گروه ۳ (G3)' },
  ];
  const names = ['پارامتر یک', 'پارامتر دو', 'پارامتر سه', 'پارامتر چهار', 'پارامتر پنج', 'پارامتر شش'];
  p.params = names.map((name, i) => ({
    id: `p${i + 1}`,
    code: `p${i + 1}`,
    name,
    groupId: i < 3 ? 'G1' : i < 5 ? 'G2' : 'G3',
    requirement: `الزام طراحی ${name}`,
    explanation: '',
    range: '',
    source: 'literature',
    origin: 'initial',
  }));

  // 10 experts: surgery E01 E02 E05 E06, engineering E03 E07 E08, ergonomics E04 E09 E10
  const domainOf = [S, S, M, A, S, S, M, M, A, A];
  p.experts = domainOf.map((d, i) => ({
    ...newExpert(`E${String(i + 1).padStart(2, '0')}`, d),
    id: `E${i + 1}`,
    yearsExperience: [12, 7, 9, 15, 22, 6, 11, 8, 14, 10][i],
    activityType: ['بالینی', 'بالینی', 'دانشگاهی', 'دانشگاهی', 'بالینی', 'بالینی', 'صنعتی', 'پژوهشی', 'دانشگاهی', 'پژوهشی'][i],
    consentDate: '2026-11-01',
  }));
  p.expertCodeCounter = 10;

  const today = '2026-11-01';
  const resp = (expertId: string, round: 'r1' | 'r2', ratings: Record<Id, RatingValue>, allocation: Allocation | null = null, openTexts: Record<Id, string> = {}): DelphiResponse => ({
    expertId,
    round,
    ratings,
    openTexts,
    allocation,
    consent: { given: true, at: today },
    source: 'manual',
    receivedAt: today,
  });

  // Round-2 answers, expert by expert (columns = E1 … E10). F1's answer lists:
  //   P1 = 9 8 7 7 8 9 7 5 2 CJ   → p1 (retain)       P4 = 9 8 7 7 8 9 7 5 2 4 → p2 (retain, exactly 70 %)
  //   P2 = 1 2 3 2 1 3 4 8 CJ —   → p3 (remove)       P3 = 9 9 9 9 9 9 9 1 1 4 → p6 (no consensus)
  //   p4 and p5: clearly retained (all 7–9)
  const r2: Record<Id, RatingValue[]> = {
    p1: [9, 8, 7, 7, 8, 9, 7, 5, 2, CJ],
    p2: [9, 8, 7, 7, 8, 9, 7, 5, 2, 4],
    p3: [1, 2, 3, 2, 1, 3, 4, 8, CJ, null],
    p4: [9, 8, 9, 7, 8, 9, 7, 8, 9, 8],
    p5: [8, 9, 8, 7, 9, 8, 9, 7, 8, 9],
    p6: [9, 9, 9, 9, 9, 9, 9, 1, 1, 4],
  };
  const alloc = (g: number[], pp: number[]): Allocation => ({
    groupPoints: { G1: g[0], G2: g[1], G3: g[2] },
    paramPoints: Object.fromEntries(pp.map((v, i) => [`p${i + 1}`, v])),
  });
  // F2 allocations (E05–E10 skipped the allocation and are excluded from the weights)
  const allocations: Record<string, Allocation> = {
    E1: alloc([50, 30, 20], [60, 20, 20, 50, 50, 100]),
    E2: alloc([40, 40, 20], [30, 30, 40, 80, 20, 100]),
    E3: alloc([20, 60, 20], [10, 40, 50, 25, 75, 100]),
    E4: alloc([30, 30, 30], [50, 50, 0, 40, 40, 100]),
  };
  // Round 1: the same lists one step more dispersed is not needed for the fixtures; round 1 = round 2 answers.
  for (let i = 0; i < 10; i++) {
    const id = `E${i + 1}`;
    const ratings = Object.fromEntries(Object.entries(r2).map(([k, v]) => [k, v[i]]));
    p.responses.r1[id] = resp(id, 'r1', ratings, null, i === 0 ? { G1: 'پیشنهاد: تهویه زیر پیش‌بند' } : i === 2 ? { G2: 'تهویه و خنک‌سازی' } : {});
    p.responses.r2[id] = resp(id, 'r2', ratings, allocations[id] ?? null);
    p.experts[i].status.r1 = { state: 'responded', date: today };
    p.experts[i].status.r2 = { state: 'responded', date: today };
  }
  p.codings = {
    'E1|G1': { key: 'E1|G1', candidateIds: ['c1'], paramIds: [], commentOnly: false, displayText: null, note: '' },
    'E3|G2': { key: 'E3|G2', candidateIds: ['c2'], paramIds: [], commentOnly: false, displayText: null, note: '' },
  };
  // F5-style candidate: E01 and E03 → 2 distinct experts; 20 % of 10 respondents = 2 → meets the threshold.
  // It is overridden to "reject" here only to keep the fixture's parameter list unchanged (reason recorded).
  p.candidates = [
    { id: 'c1', label: 'تهویه زیر پیش‌بند', mergedInto: null, override: 'reject', overrideReason: 'نمونه حل‌شده: فهرست پارامترها ثابت می‌ماند', paramId: null },
    { id: 'c2', label: 'تهویه و خنک‌سازی', mergedInto: 'c1', override: null, overrideReason: '', paramId: null },
  ];

  // F4: screening
  p.concepts = ['C1', 'C2', 'C3', 'C4', 'C5'].map((id, i) => ({
    id,
    code: id,
    name: ['ساده‌ترین (مرجع اجرای اول)', 'کانسپت دو', 'کانسپت سه', 'کانسپت چهار', 'کانسپت پنج'][i],
    sketch: null,
    description: 'کانسپت نمونه حل‌شده (SPEC.md بخش ۶، F4).',
    feasible: true,
  }));
  const raters = p.screening.raters.map((r) => r.id);
  const P = ['p1', 'p2', 'p4', 'p5'];
  p.screening.paramIds = P;
  p.screening.run1.datumId = 'C1';
  const v1: Record<string, PughSymbol[][]> = {
    // per parameter: votes of rater 1, 2, 3
    C2: [['+', '+', 'S'], ['+', '+', '+'], ['+', '-', 'S'], ['-', '-', '+']],
    C3: [['S', 'S', '+'], ['-', '-', 'S'], ['S', 'S', 'S'], ['-', 'S', '-']],
    C4: [['+', '+', '+'], ['+', 'S', '+'], ['+', '+', 'S'], ['-', '-', '-']],
    C5: [['+', '-', 'S'], ['S', 'S', 'S'], ['S', 'S', '+'], ['S', '-', 'S']],
  };
  p.screening.run1.votes = Object.fromEntries(
    raters.map((r, ri) => [r, Object.fromEntries(Object.entries(v1).map(([c, byP]) => [c, Object.fromEntries(P.map((prm, pi) => [prm, byP[pi][ri]]))]))]),
  );
  const v2: Record<string, string> = { C2: 'S + - S', C5: '- S - S', C1: '- - - +' };
  p.screening.run2.datumId = 'C4';
  p.screening.run2.votes = Object.fromEntries(
    raters.map((r) => [r, Object.fromEntries(Object.entries(v2).map(([c, s]) => [c, Object.fromEntries(P.map((prm, pi) => [prm, s.split(' ')[pi] as PughSymbol]))]))]),
  );

  // F3: weighted matrix — W = (0.6, 0.4) typed by hand; K1 = C2, K2 = C4, K3 = C1
  p.weighted.columns = [
    { paramId: 'p1', weight: 0.6 },
    { paramId: 'p2', weight: 0.4 },
  ];
  p.weighted.conceptIds = ['C2', 'C4', 'C1'];
  p.weighted.raterIds = ['E1', 'E2', 'E5', 'E3', 'E7', 'E4']; // surgery ×3, engineering ×2, ergonomics ×1
  const f3: Record<string, Record<string, number[]>> = {
    // raters in the order above
    C2: { p1: [4, 5, 3, 3, 4, 4], p2: [2, 3, 3, 2, 2, 3] },
    C4: { p1: [3, 3, 4, 4, 5, 3], p2: [4, 4, 5, 4, 3, 4] },
    C1: { p1: [2, 2, 3, 2, 3, 2], p2: [5, 4, 5, 5, 5, 5] },
  };
  p.weighted.scores = Object.fromEntries(
    p.weighted.raterIds.map((e, ri) => [e, Object.fromEntries(Object.entries(f3).map(([c, byP]) => [c, { p1: byP.p1[ri], p2: byP.p2[ri] }]))]),
  );
  for (const id of p.weighted.raterIds) p.experts.find((e) => e.id === id)!.status.pugh = { state: 'responded', date: today };

  p.settingsSnapshot = { at: today, scale: structuredClone(p.scale), consensus: { ...p.settings.consensus }, candidatePct: p.settings.candidatePct };
  const identities = Object.fromEntries(p.experts.map((e, i) => [e.id, { name: `خبره نمونه ${i + 1}`, contact: `expert${i + 1}@example.org`, notes: 'داده ساختگی' }]));
  return { project: p, identities };
}
