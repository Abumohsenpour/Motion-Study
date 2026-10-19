/** Fixture F5 (SPEC § 6): the 20 % rule for adding parameters from round-1 open answers. */
import { describe, expect, it } from 'vitest';
import { candidateMinSupport, candidateSupport, canonical, meetsCandidateThreshold } from '../delphi/candidates';

describe('F5: candidate threshold (hand-calculated)', () => {
  const codings = [
    { expertId: 'E01', candidateId: 'X' },
    { expertId: 'E04', candidateId: 'X' },
    { expertId: 'E04', candidateId: 'X' }, // same expert again (another group) → counts once
    { expertId: 'E09', candidateId: 'X' },
    { expertId: 'E02', candidateId: 'Y' },
    { expertId: 'E03', candidateId: 'Y' },
    { expertId: 'E05', candidateId: 'Z' },
    { expertId: 'E06', candidateId: 'Z2' },
    { expertId: 'E07', candidateId: 'Z2' },
  ];
  const mergedInto = { X: null, Y: null, Z: null, Z2: 'Z' }; // Z2 is a synonym of Z

  it('counts distinct experts after merging synonyms', () => {
    const s = candidateSupport(codings, mergedInto);
    expect(s.get('X')!.size).toBe(3); // E01, E04, E09
    expect(s.get('Y')!.size).toBe(2); // E02, E03
    expect(s.get('Z')!.size).toBe(3); // E05 + E06, E07 from Z2
    expect(s.has('Z2')).toBe(false);
  });

  it('applies 20 % of round-1 respondents', () => {
    // 15 respondents: 3·100 = 300 ≥ 20·15 = 300 ✓ ; 2·100 = 200 < 300 ✗
    expect(meetsCandidateThreshold(3, 15)).toBe(true);
    expect(meetsCandidateThreshold(2, 15)).toBe(false);
    // 13 respondents: 20 % = 2.6 → 3 needed
    expect(candidateMinSupport(13)).toBe(3);
    expect(meetsCandidateThreshold(2, 13)).toBe(false);
    // 10 respondents: 2 needed
    expect(candidateMinSupport(10)).toBe(2);
    expect(meetsCandidateThreshold(2, 10)).toBe(true);
    // no respondents → never
    expect(meetsCandidateThreshold(1, 0)).toBe(false);
  });

  it('follows chains of merges and survives cycles', () => {
    expect(canonical('A', { A: 'B', B: 'C', C: null })).toBe('C');
    expect(['A', 'B']).toContain(canonical('A', { A: 'B', B: 'A' }));
  });
});
