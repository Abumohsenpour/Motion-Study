/**
 * Band counts and descriptive statistics for one parameter (proposal و) ۲ ب: «برای هر پارامتر، میانه،
 * دامنه بین چارکی و درصد پاسخ‌ها در سه‌طبقه … به‌صورت کلی و به تفکیک حوزه محاسبه می‌شود»).
 */
import { quartiles, type Quartiles } from '../stats';
import { bandIndex, isValidRating } from '../scale';
import { CJ, type Id, type RatingScale, type RatingValue } from '../types';

export interface BandStats extends Quartiles {
  /** Answers «توانایی قضاوت ندارم» (not valid). */
  nCannotJudge: number;
  /** Blank answers, and answers outside the scale after a scale edit (not valid). */
  nMissing: number;
  /** Count of valid answers per band, bottom → top. */
  counts: number[];
  /** Percent of valid answers per band (null when n = 0). For display only; decisions use counts. */
  percents: (number | null)[];
}

export function bandStats(values: readonly (RatingValue | undefined)[], s: RatingScale): BandStats {
  const valid: number[] = [];
  let nCannotJudge = 0;
  let nMissing = 0;
  for (const v of values) {
    if (v === CJ) nCannotJudge++;
    else if (isValidRating(v, s)) valid.push(v);
    else nMissing++;
  }
  const counts = s.bands.map(() => 0);
  for (const v of valid) counts[bandIndex(v, s)]++;
  const n = valid.length;
  return { ...quartiles(valid), nCannotJudge, nMissing, counts, percents: counts.map((c) => (n ? (100 * c) / n : null)) };
}

/** The same statistics split by the rater's domain. */
export function bandStatsByDomain(
  ratings: readonly { domainId: Id; value: RatingValue | undefined }[],
  domains: readonly { id: Id }[],
  s: RatingScale,
): Record<Id, BandStats> {
  return Object.fromEntries(
    domains.map((d) => [d.id, bandStats(ratings.filter((r) => r.domainId === d.id).map((r) => r.value), s)]),
  );
}
