/** The rating scale and its interpretation bands (proposal: «مقیاس امتیازدهی و مبنای انتخاب آن»). */
import { CJ, type RatingScale, type RatingValue } from './types';

/** The proposal's default: 9-point scale, bands 1–3 / 4–6 / 7–9, with an optional "cannot judge". */
export function defaultRatingScale(): RatingScale {
  return {
    min: 1,
    max: 9,
    bands: [
      { id: 'low', label: 'کم‌اهمیت', from: 1, to: 3 },
      { id: 'mid', label: 'مهم اما نه حیاتی', from: 4, to: 6 },
      { id: 'high', label: 'حیاتی', from: 7, to: 9 },
    ],
    allowCannotJudge: true,
    cannotJudgeLabel: 'توانایی قضاوت ندارم',
  };
}

/** A valid response is an integer inside the scale (SPEC § 1.1). "Cannot judge" and blanks are not valid. */
export const isValidRating = (v: RatingValue | undefined, s: RatingScale): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= s.min && v <= s.max;

/** Index of the band that contains v, or −1. */
export const bandIndex = (v: number, s: RatingScale): number => s.bands.findIndex((b) => v >= b.from && v <= b.to);

/** True when the answer exists (a rating or "cannot judge"), i.e. the question was answered at all. */
export const isAnswered = (v: RatingValue | undefined): boolean => v === CJ || typeof v === 'number';

export type ScaleProblem = 'range' | 'need-two-bands' | 'coverage' | { band: string };

/**
 * Bands must be ordered, contiguous, non-overlapping and cover [min, max] exactly, with at least two
 * bands. Returns the problems found (empty = valid).
 */
export function validateScale(s: RatingScale): ScaleProblem[] {
  const problems: ScaleProblem[] = [];
  if (!(Number.isInteger(s.min) && Number.isInteger(s.max) && s.min < s.max)) problems.push('range');
  if (s.bands.length < 2) problems.push('need-two-bands');
  let next = s.min;
  for (const b of s.bands) {
    if (b.from !== next || b.to < b.from) problems.push({ band: b.id });
    next = b.to + 1;
  }
  if (next !== s.max + 1) problems.push('coverage');
  return problems;
}
