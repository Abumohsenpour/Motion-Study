/** Fixture F4 (SPEC § 6): Pugh screening in two runs, majority votes, dominance and forwarding. */
import { describe, expect, it } from 'vitest';
import { bestOfRun, evaluateRun, forwardConcepts, majoritySymbol, screeningTotals } from '../pugh/screening';
import type { PughSymbol } from '../types';

const P = ['p1', 'p2', 'p3', 'p4'];
const fromString = (m: Record<string, string>) => (c: string, p: string) => m[c].split(' ')[P.indexOf(p)] as PughSymbol;

describe('majority vote (tie → S)', () => {
  it('follows «رأی اکثریت … در صورت تساوی آرا، S»', () => {
    expect(majoritySymbol(['-', '-', '+'])).toBe('-'); // 2 of 3
    expect(majoritySymbol(['+', '-', 'S'])).toBe('S'); // 1-1-1 tie
    expect(majoritySymbol(['+', '+', 'S', 'S'])).toBe('S'); // 2-2 tie
    expect(majoritySymbol(['+', '+', '-', 'S'])).toBe('+'); // plurality 2 of 4
    expect(majoritySymbol(['+', null, undefined])).toBe('+'); // missing votes ignored
    expect(majoritySymbol([null, undefined])).toBeNull(); // nobody voted
  });
});

describe('totals and the dominance rule', () => {
  it('net = #(+) − #(−); dominated = no + and at least one −', () => {
    expect(screeningTotals(['+', '+', 'S', '-'])).toMatchObject({ plus: 2, minus: 1, same: 1, net: 1, dominated: false });
    expect(screeningTotals(['S', '-', 'S', '-'])).toMatchObject({ net: -2, dominated: true });
    expect(screeningTotals(['S', 'S', 'S', 'S'])).toMatchObject({ net: 0, dominated: false, hasPlus: false });
    expect(screeningTotals(['S', null, 'S', 'S'])).toMatchObject({ empty: 1, dominated: false });
  });
});

describe('F4: two runs (hand-calculated)', () => {
  // Run 1, datum C1, three raters' votes per cell
  const votes: Record<string, Record<string, PughSymbol[]>> = {
    C2: { p1: ['+', '+', 'S'], p2: ['+', '+', '+'], p3: ['+', '-', 'S'], p4: ['-', '-', '+'] },
    C3: { p1: ['S', 'S', '+'], p2: ['-', '-', 'S'], p3: ['S', 'S', 'S'], p4: ['-', 'S', '-'] },
    C4: { p1: ['+', '+', '+'], p2: ['+', 'S', '+'], p3: ['+', '+', 'S'], p4: ['-', '-', '-'] },
    C5: { p1: ['+', '-', 'S'], p2: ['S', 'S', 'S'], p3: ['S', 'S', '+'], p4: ['S', '-', 'S'] },
  };
  const order = ['C1', 'C2', 'C3', 'C4', 'C5'];
  const run1 = evaluateRun({ datumId: 'C1', compared: ['C2', 'C3', 'C4', 'C5'], paramIds: P, cell: (c, p) => majoritySymbol(votes[c][p]) });

  it('run 1: majority symbols, nets and eliminations', () => {
    // C2: + + S(tie) −  → 2/1/1, net 1
    // C3: S − S −       → 0/2/2, net −2, dominated
    // C4: + + + −       → 3/1/0, net 2
    // C5: S(tie) S S S  → 0/0/4, net 0, not dominated (no −)
    expect(run1.totals.C2).toMatchObject({ plus: 2, minus: 1, same: 1, net: 1 });
    expect(run1.totals.C3).toMatchObject({ net: -2, dominated: true });
    expect(run1.totals.C4).toMatchObject({ plus: 3, minus: 1, net: 2 });
    expect(run1.totals.C5).toMatchObject({ same: 4, net: 0, dominated: false });
    expect(run1.eliminated).toEqual(['C3']);
    expect(bestOfRun(run1, order)).toEqual(['C4']);
  });

  it('run 2 against the best, then forwarding', () => {
    // compared: run-1 survivors C2, C5 and the run-1 datum C1
    const run2 = evaluateRun({
      datumId: 'C4',
      compared: ['C2', 'C5', 'C1'],
      paramIds: P,
      cell: fromString({ C2: 'S + - S', C5: '- S - S', C1: '- - - +' }),
    });
    expect(run2.totals.C2).toMatchObject({ net: 0, hasPlus: true }); // kept
    expect(run2.totals.C5).toMatchObject({ net: -2, dominated: true }); // eliminated
    expect(run2.totals.C1).toMatchObject({ net: -2, hasPlus: true }); // kept
    const f = forwardConcepts(run2, () => true, order);
    expect(f.forwarded).toEqual(['C4', 'C2', 'C1']);
    expect(f.reason).toEqual({ C4: 'best', C2: 'kept-has-plus', C1: 'kept-has-plus', C5: 'dominated' });
    expect(f.safetyRuleUsed).toBe(false);
  });
});

describe('forwarding edge cases', () => {
  const order = ['X', 'A', 'B', 'C', 'D', 'E'];

  it('the best dominates all others → the highest run-2 net also goes forward', () => {
    const run2 = evaluateRun({ datumId: 'X', compared: ['A', 'B'], paramIds: P, cell: fromString({ A: '- - S S', B: '- S S S' }) });
    const f = forwardConcepts(run2, () => true, order);
    expect(f.bestDominatesAll).toBe(true);
    expect(f.forwarded).toEqual(['X', 'B']); // B net −1 > A net −2
    expect(f.reason.B).toBe('safety-rule');
  });

  it('more than four: the best keeps its place; a tie at the cutoff is flagged and resolvable', () => {
    const m = { A: '+ + + -', B: '+ + - -', C: '+ - - -', D: '+ + - -', E: '+ S S S' };
    // nets: A 2, E 1, B 0, D 0, C −2 → 3 places after the best: A, E, then B or D (tie)
    const run2 = evaluateRun({ datumId: 'X', compared: Object.keys(m), paramIds: P, cell: fromString(m) });
    const f = forwardConcepts(run2, () => true, order);
    expect(f.forwarded).toEqual(['X', 'A', 'E', 'B']);
    expect(f.tieAtCutoff).toEqual(['B', 'D']);
    expect(f.reason.D).toBe('cap-exceeded');
    expect(f.reason.C).toBe('cap-exceeded');
    const chosen = forwardConcepts(run2, () => true, order, 4, 2, ['D']);
    expect(chosen.forwarded).toEqual(['X', 'A', 'E', 'D']);
  });

  it('a concept that is all S against the best is not forwarded by itself (DECISIONS D-36)', () => {
    const run2 = evaluateRun({ datumId: 'X', compared: ['A', 'B'], paramIds: P, cell: fromString({ A: 'S S S S', B: '+ - S S' }) });
    const f = forwardConcepts(run2, () => true, order);
    expect(f.forwarded).toEqual(['X', 'B']);
    expect(f.reason.A).toBe('equivalent-no-plus');
  });

  it('…but the safety rule forwards it when it is the only other option (DECISIONS D-38)', () => {
    const run2 = evaluateRun({ datumId: 'X', compared: ['A'], paramIds: P, cell: () => 'S' });
    const f = forwardConcepts(run2, () => true, order);
    expect(f.forwarded).toEqual(['X', 'A']);
    expect(f.reason.A).toBe('safety-rule');
    expect(f.bestDominatesAll).toBe(false);
  });

  it('infeasible concepts never go forward, and are removed before the cap', () => {
    const run2 = evaluateRun({ datumId: 'X', compared: ['A', 'B', 'C'], paramIds: P, cell: fromString({ A: '+ S S S', B: '+ S S -', C: '- S S S' }) });
    const f = forwardConcepts(run2, (c) => c !== 'A', order);
    expect(f.forwarded).toEqual(['X', 'B']);
    expect(f.reason.A).toBe('infeasible');
    expect(f.reason.C).toBe('dominated');
  });

  it('an infeasible best is reported and the rest still follow the rules', () => {
    const run2 = evaluateRun({ datumId: 'X', compared: ['A', 'B'], paramIds: P, cell: fromString({ A: '+ S S S', B: '+ + S S' }) });
    const f = forwardConcepts(run2, (c) => c !== 'X', order);
    expect(f.reason.X).toBe('infeasible');
    expect(f.forwarded).toEqual(['B', 'A']);
  });

  it('the run-1 datum can be the best (net 0 beats negative nets)', () => {
    const run1 = evaluateRun({ datumId: 'X', compared: ['A', 'B'], paramIds: P, cell: fromString({ A: '+ - - S', B: '+ - - -' }) });
    expect(bestOfRun(run1, order)).toEqual(['X']);
  });

  it('ties for the best are all returned, in display order', () => {
    const run1 = evaluateRun({ datumId: 'X', compared: ['A', 'B'], paramIds: P, cell: fromString({ A: '+ + S S', B: '+ + - +' }) });
    expect(bestOfRun(run1, order)).toEqual(['A', 'B']);
  });
});
