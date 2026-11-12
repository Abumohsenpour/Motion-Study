/**
 * Band charts: how the valid answers of each domain fall into the bands of the importance scale.
 *
 * Encoding: one row per domain in the domain's colour (identity) plus a neutral row for the whole panel; the bands
 * are steps of opacity within that colour, dark → light = top → bottom band (magnitude). The top band starts at
 * the axis origin, so its share (the quantity the consensus rule looks at) can be compared down the figure.
 * Every row carries the domain's short label and every chart has a legend, so colour is never the only signal.
 */
import { currentLang, tr, type Lang } from '../i18n';
import type { Fmt } from '../ui/format';
import { Canvas, THEME, esc, heading, textWidth, truncate } from './svg';

export interface BandRow {
  short: string;
  name: string;
  color: string;
  n: number;
  /** Per band, bottom → top. */
  counts: number[];
  percents: (number | null)[];
}

/** Opacity of band i of k (bottom band lightest). */
export const bandOpacity = (i: number, k: number): number => (k <= 1 ? 1 : 0.3 + (0.7 * i) / (k - 1));

/** Compact per-domain stacked bars for a table cell (no text; tooltips carry the numbers). */
export function miniBandBars(rows: BandRow[], bands: string[], fmt: Fmt, width = 150, lang: Lang = currentLang()): string {
  const rowH = 12;
  const gap = 4;
  const chip = 14;
  const barW = width - chip - 4;
  const h = rows.length * (rowH + gap) - gap;
  const c = new Canvas(lang, width);
  const k = bands.length;
  rows.forEach((r, ri) => {
    const y = ri * (rowH + gap);
    c.chip(0, y - 1, chip, rowH + 2, r.short, r.color);
    const x0 = chip + 4;
    if (!r.n) {
      c.rect(x0, y, barW, rowH, { rx: 2, stroke: 'currentColor', dash: '3 2', title: `${r.name}: ${tr(lang, 'پاسخ معتبری نیست')}` });
      return;
    }
    let x = x0;
    for (let bi = k - 1; bi >= 0; bi--) {
      const pc = r.percents[bi] ?? 0;
      const w = (pc / 100) * barW;
      if (w <= 0) continue;
      c.rect(x, y, Math.max(0.5, w - 2), rowH, {
        fill: r.color,
        opacity: bandOpacity(bi, k),
        rx: 2,
        title: `${r.name} — ${bands[bi]}: ${fmt.pct(pc, 1)} (${tr(lang, '{a} از {b}', { a: fmt.int(r.counts[bi]), b: fmt.int(r.n) })})`,
      });
      x += w;
    }
  });
  return c.svg(h, rows.map((r) => `${r.name}: ${r.percents.map((p, i) => `${bands[i]} ${fmt.pct(p, 0)}`).join(', ')}`).join(' | '));
}

export interface FigureItem {
  code: string;
  name: string;
  /** Domain rows. */
  rows: BandRow[];
  /** Whole panel (optional extra row, drawn first in a neutral colour). */
  overall?: Omit<BandRow, 'short' | 'name' | 'color'>;
}

export interface BandFigureOpts {
  lang?: Lang;
  width?: number;
  title?: string;
  subtitle?: string;
  /** Percent of the top band needed for "retain" (drawn as a marker on the whole-panel row). */
  threshold?: number;
}

/** Splits a name into at most two lines of about `n` characters. */
function twoLines(s: string, n: number): string[] {
  if (s.length <= n) return [s];
  const cut = s.lastIndexOf(' ', n);
  const i = cut > n * 0.5 ? cut : n;
  return [s.slice(0, i).trim(), truncate(s.slice(i).trim(), n)];
}

/**
 * Figure for the thesis: for each parameter, one 100 % stacked bar for the whole panel and one per domain, with
 * the percentages written inside the segments.
 */
export function bandFigure(items: FigureItem[], bands: string[], fmt: Fmt, opts: BandFigureOpts = {}): string {
  const lang = opts.lang ?? 'fa';
  const T = (fa: string, v?: Record<string, string | number>) => tr(lang, fa, v);
  const W = opts.width ?? 820;
  const pad = 22;
  const c = new Canvas(lang, W);
  const k = bands.length;
  const labelW = 236;
  const chipW = 20;
  const nW = 50;
  const x0 = pad + labelW + chipW + 8;
  const barW = W - pad - nW - x0;
  const rowH = 16;
  const rowGap = 3;
  const blockGap = 18;
  let y = heading(c, pad, opts.title, opts.subtitle);

  // ---- legend: bands (neutral swatches, top band first), then the rows
  let lx = pad;
  const legendItem = (draw: (x: number) => number, w: number) => {
    if (lx + w > W - pad) {
      lx = pad;
      y += 20;
    }
    lx = draw(lx) + 16;
  };
  for (let bi = k - 1; bi >= 0; bi--) {
    const label = bands[bi];
    legendItem((x) => {
      c.rect(x, y, 14, 12, { fill: THEME.overall, opacity: bandOpacity(bi, k), rx: 2 });
      c.text(x + 19, y + 10, label, { size: 11 });
      return x + 19 + textWidth(label, 11);
    }, 19 + textWidth(label, 11));
  }
  lx = pad;
  y += 22;
  const first = items[0];
  const legendRows = [...(first?.overall ? [{ short: 'Σ', name: T('کل پنل'), color: THEME.overall }] : []), ...(first?.rows ?? [])];
  for (const d of legendRows) {
    legendItem((x) => {
      c.chip(x, y - 1, chipW, 14, d.short, d.color);
      c.text(x + chipW + 5, y + 10, d.name, { size: 11 });
      return x + chipW + 5 + textWidth(d.name, 11);
    }, chipW + 5 + textWidth(d.name, 11));
  }
  if (opts.threshold !== undefined) {
    const label = T('آستانه «حفظ»: {n} در طبقه بالا (کل پنل)', { n: fmt.pct(opts.threshold, 0) });
    legendItem((x) => {
      c.line(x + 4, y - 2, x + 4, y + 14, { stroke: THEME.ink, width: 2 });
      c.text(x + 12, y + 10, label, { size: 11 });
      return x + 12 + textWidth(label, 11);
    }, 12 + textWidth(label, 11));
  }
  y += 40;

  // ---- axis: 0 … 100 %, grid lines behind the bars
  const rowsPer = (it: FigureItem) => it.rows.length + (it.overall ? 1 : 0);
  const bodyH = items.reduce((s, it) => s + Math.max(rowsPer(it) * (rowH + rowGap) - rowGap, 34) + blockGap, 0) - blockGap;
  for (const tick of [0, 25, 50, 75, 100]) {
    const x = x0 + (tick / 100) * barW;
    c.line(x, y - 4, x, y + bodyH + 4, { stroke: THEME.grid });
    c.text(x, y - 9, fmt.pct(tick, 0), { size: 10, fill: THEME.faint, anchor: 'middle' });
  }
  c.text(W - pad, y - 9, 'n', { size: 10, fill: THEME.faint, anchor: 'end', ltr: true });

  for (const it of items) {
    const rows: (Omit<BandRow, 'name'> & { isOverall?: boolean })[] = [...(it.overall ? [{ ...it.overall, short: 'Σ', color: THEME.overall, isOverall: true }] : []), ...it.rows];
    const blockH = Math.max(rows.length * (rowH + rowGap) - rowGap, 34);
    c.text(pad, y + 12, it.code, { size: 12, weight: 700, ltr: true });
    twoLines(it.name, 38).forEach((line, li) => c.text(pad, y + 28 + li * 15, line, { size: 11.5, fill: THEME.muted }));
    rows.forEach((r, ri) => {
      const ry = y + ri * (rowH + rowGap);
      c.chip(pad + labelW, ry, chipW, rowH, r.short, r.color);
      if (!r.n) {
        c.rect(x0, ry + 1, barW, rowH - 2, { rx: 3, stroke: THEME.faint, dash: '3 3' });
        c.text(x0 + 8, ry + rowH - 4, T('بدون پاسخ معتبر'), { size: 10.5, fill: THEME.faint });
        return;
      }
      let x = x0;
      for (let bi = k - 1; bi >= 0; bi--) {
        const pc = r.percents[bi] ?? 0;
        const w = (pc / 100) * barW;
        if (w <= 0) continue;
        const op = bandOpacity(bi, k);
        c.rect(x, ry, Math.max(1, w - 2), rowH, { fill: r.color, opacity: op, rx: 3 });
        if (w >= 30) c.text(x + (w - 2) / 2, ry + rowH - 4.5, fmt.pct(pc, 0), { size: 10, weight: 600, anchor: 'middle', fill: op > 0.6 ? '#ffffff' : THEME.ink });
        x += w;
      }
      c.text(W - pad, ry + rowH - 4, fmt.int(r.n), { size: 10.5, fill: THEME.muted, anchor: 'end' });
      if (r.isOverall && opts.threshold !== undefined) {
        const tx = x0 + (opts.threshold / 100) * barW;
        c.line(tx, ry - 3, tx, ry + rowH + 3, { stroke: THEME.ink, width: 2 });
      }
    });
    y += blockH + blockGap;
  }
  return c.svg(y - blockGap + pad, esc(opts.title ?? T('توزیع پاسخ‌ها در طبقه‌ها به تفکیک حوزه')));
}
