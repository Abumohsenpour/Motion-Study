/**
 * Panel description and response rates (proposal و) ۲ الف). Reported only as aggregates and ranges
 * (ethics ۹–۴): frequency, %, median (IQR); never minimum, maximum or individual values.
 */
import type { Id } from '../types';

/** respondents ÷ invited; null when nobody was invited. */
export const responseRate = (respondents: number, invited: number): number | null =>
  invited > 0 ? respondents / invited : null;

/** 1 − (round-1 respondents who also answered round 2) ÷ round-1 respondents (DECISIONS D-63). */
export function attrition(r1Respondents: readonly Id[], r2Respondents: readonly Id[]): number | null {
  const stayed = r1Respondents.filter((id) => r2Respondents.includes(id)).length;
  return r1Respondents.length ? 1 - stayed / r1Respondents.length : null;
}

/** Edges [5,10,15,20] → counts for <5, 5–9, 10–14, 15–19, ≥20. */
export function binCounts(values: readonly number[], edges: readonly number[]): number[] {
  const counts = new Array<number>(edges.length + 1).fill(0);
  for (const v of values) counts[edges.filter((e) => v >= e).length]++;
  return counts;
}

/** Frequency table of a categorical value (e.g. activity type), in first-seen order. */
export function frequencies(values: readonly string[]): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([value, count]) => ({ value, count }));
}
