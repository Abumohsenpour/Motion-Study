/**
 * Number and date formatting. Persian digits by default, Latin digits on request (DECISIONS D-58).
 * Decimal separator «٫», no thousands grouping. Dates are shown in the Solar Hijri calendar.
 */
import { useMemo } from 'react';
import { usePrefs, type DigitMode } from '../state/prefs';

export interface Fmt {
  mode: DigitMode;
  /** Fixed number of decimals; '—' for null/NaN. */
  num: (x: number | null | undefined, decimals?: number) => string;
  /** Up to `maxDecimals`, trailing zeros removed. */
  auto: (x: number | null | undefined, maxDecimals?: number) => string;
  int: (x: number | null | undefined) => string;
  /** x is already in percent (0–100). */
  pct: (x: number | null | undefined, decimals?: number) => string;
  /** Converts the digits inside a free text. */
  digits: (s: string) => string;
  /** ISO date → Solar Hijri date (with the Gregorian date in the title attribute where used). */
  date: (iso: string | null | undefined) => string;
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function makeFmt(mode: DigitMode): Fmt {
  const locale = mode === 'fa' ? 'fa-IR' : 'en-US';
  const cache = new Map<string, Intl.NumberFormat>();
  const nf = (min: number, max: number) => {
    const k = `${min}-${max}`;
    if (!cache.has(k)) cache.set(k, new Intl.NumberFormat(locale, { useGrouping: false, minimumFractionDigits: min, maximumFractionDigits: max }));
    return cache.get(k)!;
  };
  const bad = (x: number | null | undefined): x is null | undefined => x === null || x === undefined || !Number.isFinite(x);
  const dateFmt = new Intl.DateTimeFormat(mode === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US-u-ca-persian-nu-latn', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return {
    mode,
    num: (x, d = 2) => (bad(x) ? '—' : nf(d, d).format(x)),
    auto: (x, d = 4) => (bad(x) ? '—' : nf(0, d).format(x)),
    int: (x) => (bad(x) ? '—' : nf(0, 0).format(x)),
    pct: (x, d = 1) => (bad(x) ? '—' : nf(d, d).format(x) + (mode === 'fa' ? '٪' : '%')),
    digits: (s) => (mode === 'fa' ? s.replace(/[0-9]/g, (c) => FA_DIGITS[+c]) : s),
    date: (iso) => {
      if (!iso) return '—';
      const t = Date.parse(iso.length === 10 ? iso + 'T12:00:00' : iso);
      return Number.isNaN(t) ? iso : dateFmt.format(t);
    },
  };
}

export function useFmt(): Fmt {
  const mode = usePrefs((s) => s.digits);
  return useMemo(() => makeFmt(mode), [mode]);
}

/** Accepts Persian, Arabic-Indic or Latin digits and «٫» / «,» / «.» as the decimal mark. */
export function parseNumber(input: string): number | null {
  const s = input
    .trim()
    .replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[٫،,]/g, '.')
    .replace(/[‌‏‎\s]/g, '')
    .replace(/^−/, '-');
  if (s === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
