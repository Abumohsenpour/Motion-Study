/**
 * Pugh concept screening (unweighted, + / − / S), proposal «گام دوم - غربال اولیه کانسپت‌ها».
 *
 * - Each cell's symbol is the majority (plurality) vote of the research team; a tie gives S.
 * - Net score = #(+) − #(−).
 * - Dominance: a concept with no "+" and at least one "−" against the datum is dominated and eliminated.
 * - Run 1: datum = simplest concept; the highest net score is the best concept.
 * - Run 2: datum = the best of run 1; the run-1 survivors and the run-1 datum are compared with it.
 *   Dominated → eliminated; at least one "+" → kept. The best and the kept concepts go forward if technically
 *   feasible; at most four (higher run-2 net first); at least two (safety rule).
 */
import type { Id, PughSymbol } from '../types';

/** Plurality vote; a tie for the most votes gives S («در صورت تساوی آرا، S ثبت می‌شود»). Null when nobody voted. */
export function majoritySymbol(votes: readonly (PughSymbol | null | undefined)[]): PughSymbol | null {
  const c: Record<PughSymbol, number> = { '+': 0, '-': 0, S: 0 };
  let any = false;
  for (const v of votes)
    if (v) {
      c[v]++;
      any = true;
    }
  if (!any) return null;
  const max = Math.max(c['+'], c['-'], c.S);
  const winners = (Object.keys(c) as PughSymbol[]).filter((k) => c[k] === max);
  return winners.length === 1 ? winners[0] : 'S';
}

export interface ScreeningTotals {
  plus: number;
  minus: number;
  same: number;
  /** Cells nobody filled (not counted; the run is incomplete). */
  empty: number;
  /** #(+) − #(−) */
  net: number;
  /** No "+" and at least one "−" against the datum. */
  dominated: boolean;
  hasPlus: boolean;
}

export function screeningTotals(column: readonly (PughSymbol | null)[]): ScreeningTotals {
  const plus = column.filter((v) => v === '+').length;
  const minus = column.filter((v) => v === '-').length;
  const same = column.filter((v) => v === 'S').length;
  const empty = column.filter((v) => v === null).length;
  return { plus, minus, same, empty, net: plus - minus, dominated: plus === 0 && minus >= 1, hasPlus: plus >= 1 };
}

export interface RunInput {
  datumId: Id;
  /** Concepts compared with the datum (the datum itself excluded). */
  compared: readonly Id[];
  paramIds: readonly Id[];
  cell: (conceptId: Id, paramId: Id) => PughSymbol | null;
}

export interface RunResult {
  datumId: Id;
  totals: Record<Id, ScreeningTotals>;
  eliminated: Id[];
  survivors: Id[];
}

export function evaluateRun(r: RunInput): RunResult {
  const totals: Record<Id, ScreeningTotals> = {};
  for (const c of r.compared) totals[c] = screeningTotals(r.paramIds.map((p) => r.cell(c, p)));
  return {
    datumId: r.datumId,
    totals,
    eliminated: r.compared.filter((c) => totals[c].dominated),
    survivors: r.compared.filter((c) => !totals[c].dominated),
  };
}

/**
 * Run-1 "best" = highest net score among the survivors and the datum (whose net is 0).
 * Returns every concept tied for the highest net, in display order (DECISIONS D-34).
 */
export function bestOfRun(run: RunResult, displayOrder: readonly Id[]): Id[] {
  const cand = [run.datumId, ...run.survivors];
  const net = (c: Id) => (c === run.datumId ? 0 : run.totals[c].net);
  const max = Math.max(...cand.map(net));
  return displayOrder.filter((c) => cand.includes(c) && net(c) === max);
}

export type ForwardReason =
  | 'best'
  | 'kept-has-plus'
  | 'safety-rule'
  | 'dominated'
  | 'equivalent-no-plus'
  | 'cap-exceeded'
  | 'infeasible';

export interface ForwardResult {
  /** Concepts that go to the weighted matrix, best first. */
  forwarded: Id[];
  reason: Record<Id, ForwardReason>;
  /** Concepts tied at the cutoff of `maxForward` (the researcher chooses; DECISIONS D-37). */
  tieAtCutoff: Id[];
  /** The proposal's literal trigger of the safety rule. */
  bestDominatesAll: boolean;
  /** The safety rule fired (literal trigger or the generalisation, DECISIONS D-38). */
  safetyRuleUsed: boolean;
}

export function forwardConcepts(
  run2: RunResult,
  feasible: (conceptId: Id) => boolean,
  displayOrder: readonly Id[],
  maxForward = 4,
  minForward = 2,
  cutoffChoice: readonly Id[] | null = null,
): ForwardResult {
  const reason: Record<Id, ForwardReason> = {};
  const best = run2.datumId;
  const compared = Object.keys(run2.totals);
  const byNet = (a: Id, b: Id) =>
    run2.totals[b].net - run2.totals[a].net || displayOrder.indexOf(a) - displayOrder.indexOf(b);

  for (const c of compared)
    reason[c] = run2.totals[c].dominated ? 'dominated' : run2.totals[c].hasPlus ? 'kept-has-plus' : 'equivalent-no-plus';

  const forwarded: Id[] = [];
  if (feasible(best)) {
    forwarded.push(best);
    reason[best] = 'best';
  } else reason[best] = 'infeasible';

  // Kept = at least one "+" against the best. Only feasible ones go forward («به‌شرط امکان‌پذیری فنی»),
  // and infeasible ones are removed before the cap is applied (DECISIONS D-39).
  const kept = compared.filter((c) => reason[c] === 'kept-has-plus');
  for (const c of kept) if (!feasible(c)) reason[c] = 'infeasible';
  const keptFeasible = kept.filter(feasible).sort(byNet);

  // More than `maxForward`: the higher run-2 net scores win; the best always keeps its place (DECISIONS D-37).
  const slots = Math.max(0, maxForward - forwarded.length);
  let tieAtCutoff: Id[] = [];
  let chosen = keptFeasible.slice(0, slots);
  if (keptFeasible.length > slots && slots > 0) {
    const cutNet = run2.totals[keptFeasible[slots - 1]].net;
    if (run2.totals[keptFeasible[slots]].net === cutNet) {
      tieAtCutoff = keptFeasible.filter((c) => run2.totals[c].net === cutNet);
      const above = keptFeasible.filter((c) => run2.totals[c].net > cutNet);
      const tiedSlots = slots - above.length;
      const pick = cutoffChoice?.filter((c) => tieAtCutoff.includes(c)).slice(0, tiedSlots) ?? [];
      const fill = tieAtCutoff.filter((c) => !pick.includes(c)).slice(0, tiedSlots - pick.length);
      chosen = [...above, ...pick, ...fill].sort(byNet);
    }
  }
  for (const c of keptFeasible) if (!chosen.includes(c)) reason[c] = 'cap-exceeded';
  forwarded.push(...chosen);

  // Safety rule: "if the best dominates all the others, the highest run-2 net also goes forward", generalised
  // to "fewer than `minForward` would be forwarded for any reason" (DECISIONS D-38).
  const bestDominatesAll = compared.length > 0 && compared.every((c) => run2.totals[c].dominated);
  let safetyRuleUsed = false;
  if (forwarded.length < minForward) {
    const pool = compared.filter((c) => !forwarded.includes(c) && feasible(c) && reason[c] !== 'cap-exceeded').sort(byNet);
    for (const c of pool.slice(0, minForward - forwarded.length)) {
      forwarded.push(c);
      reason[c] = 'safety-rule';
      safetyRuleUsed = true;
    }
  }
  // Infeasible concepts that were dominated keep the "dominated" reason (dominance is the stronger statement).
  for (const c of compared) if (!feasible(c) && !forwarded.includes(c) && reason[c] !== 'dominated') reason[c] = 'infeasible';

  return { forwarded, reason, tieAtCutoff, bestDominatesAll, safetyRuleUsed };
}
