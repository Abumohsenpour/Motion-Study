/**
 * Consensus rule, applied to round-2 valid answers only (proposal: «معیار اجماع»).
 *
 *   retain («حفظ»):  ≥ 70 % of valid answers in the top band (7–9) and ≤ 15 % in the bottom band (1–3)
 *   remove («حذف»):  ≥ 70 % in the bottom band and ≤ 15 % in the top band
 *   otherwise «فاقد اجماع»
 *
 * Median and IQR are descriptive only and are never read here.
 */
import { atLeastPct, atMostPct, maxCountAtMost, minCountAtLeast } from '../thresholds';
import type { ConsensusThresholds } from '../types';

export type ConsensusStatus = 'retain' | 'remove' | 'none';

export interface ConsensusResult {
  status: ConsensusStatus;
  retainMet: boolean;
  removeMet: boolean;
  /** Both criteria met: only possible if thresholds were edited to ≤ 50 % (DECISIONS D-11). */
  conflict: boolean;
  /** n = 0 (DECISIONS D-12). */
  noValidAnswers: boolean;
}

export const DEFAULT_THRESHOLDS: ConsensusThresholds = {
  retainTopMin: 70,
  retainBottomMax: 15,
  removeBottomMin: 70,
  removeTopMax: 15,
};

export function consensusStatus(st: { n: number; counts: readonly number[] }, t: ConsensusThresholds): ConsensusResult {
  const bottom = st.counts[0];
  const top = st.counts[st.counts.length - 1];
  const retainMet = atLeastPct(top, st.n, t.retainTopMin) && atMostPct(bottom, st.n, t.retainBottomMax);
  const removeMet = atLeastPct(bottom, st.n, t.removeBottomMin) && atMostPct(top, st.n, t.removeTopMax);
  const status: ConsensusStatus = retainMet && !removeMet ? 'retain' : removeMet && !retainMet ? 'remove' : 'none';
  return { status, retainMet, removeMet, conflict: retainMet && removeMet, noValidAnswers: st.n === 0 };
}

/** Live helper on the settings screen: "with n = … you need ≥ … in the top band and ≤ … in the bottom band". */
export function consensusHelper(n: number, t: ConsensusThresholds) {
  return {
    retainMinTop: minCountAtLeast(n, t.retainTopMin),
    retainMaxBottom: maxCountAtMost(n, t.retainBottomMax),
    removeMinBottom: minCountAtLeast(n, t.removeBottomMin),
    removeMaxTop: maxCountAtMost(n, t.removeTopMax),
  };
}

/** Settings problems: thresholds outside 0–100, or retain and remove able to hold at once. */
export function validateThresholds(t: ConsensusThresholds): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(t)) if (!(v >= 0 && v <= 100)) out.push(`range:${k}`);
  // Both rules can hold at once only if: top ≥ retainTopMin and top ≤ removeTopMax, bottom ≥ removeBottomMin and
  // bottom ≤ retainBottomMax, and top + bottom ≤ 100 %.
  const overlap =
    t.retainTopMin <= t.removeTopMax && t.removeBottomMin <= t.retainBottomMax && t.retainTopMin + t.removeBottomMin <= 100;
  if (overlap) out.push('overlap');
  return out;
}
