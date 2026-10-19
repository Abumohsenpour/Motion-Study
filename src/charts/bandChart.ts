/**
 * Domain-coloured band charts (round-1 analysis, round-2 feedback, report figures), built as SVG strings so the
 * same code renders on screen and exports to SVG/PNG.
 *
 * Encoding: one row per domain, in the domain's colour (identity); the bands are steps of opacity within that
 * colour, light → dark = bottom → top band (magnitude). Every row carries the domain's short label, so colour
 * is never the only signal, and every chart has a legend. Segments are separated by a 2px surface gap.
 */
import type { Fmt } from '../ui/format';

export interface BandRow {
  short: string;
  name: string;
  color: string;
  n: number;
  counts: number[];
  percents: (number | null)[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Opacity of band i of k (bottom band lightest). */
export const bandOpacity = (i: number, k: number): number => (k <= 1 ? 1 : 0.32 + (0.68 * i) / (k - 1));

/** Compact per-domain stacked bars for a table cell (no text; tooltips carry the numbers). */
export function miniBandBars(rows: BandRow[], bands: string[], fmt: Fmt, width = 150): string {
  const rowH = 12;
  const gap = 4;
  const chip = 14;
  const barW = width - chip - 4;
  const h = rows.length * (rowH + gap) - gap;
  const parts: string[] = [];
  rows.forEach((r, ri) => {
    const y = ri * (rowH + gap);
    // RTL: chip on the right, bar grows leftwards from the right edge
    parts.push(
      `<rect x="${width - chip}" y="${y - 1}" width="${chip}" height="${rowH + 2}" rx="3" fill="${r.color}"/>`,
      `<text x="${width - chip / 2}" y="${y + rowH / 2 + 0.5}" fill="#fff" font-size="9" font-weight="700" text-anchor="middle" dominant-baseline="middle">${esc(r.short)}</text>`,
    );
    if (!r.n) {
      parts.push(`<rect x="0" y="${y}" width="${barW}" height="${rowH}" rx="2" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="3 2"><title>${esc(r.name)}: پاسخ معتبری نیست</title></rect>`);
      return;
    }
    let x = barW;
    r.percents.forEach((pc, bi) => {
      const w = ((pc ?? 0) / 100) * barW;
      if (w <= 0) return;
      const segW = Math.max(0, w - (x - w > 0.5 ? 2 : 0));
      x -= w;
      parts.push(
        `<rect x="${x + (w - segW)}" y="${y}" width="${segW}" height="${rowH}" rx="2" fill="${r.color}" fill-opacity="${bandOpacity(bi, bands.length).toFixed(2)}"><title>${esc(r.name)} — ${esc(bands[bi])}: ${fmt.pct(pc, 1)} (${fmt.int(r.counts[bi])} از ${fmt.int(r.n)})</title></rect>`,
      );
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" style="direction:ltr" viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="${esc(rows.map((r) => `${r.name}: ${r.percents.map((p, i) => `${bands[i]} ${fmt.pct(p, 0)}`).join('، ')}`).join(' | '))}" font-family="Vazirmatn, Tahoma, sans-serif">${parts.join('')}</svg>`;
}

export interface FigureItem {
  code: string;
  name: string;
  rows: BandRow[];
}

/**
 * Report figure: for each parameter, one stacked bar per domain with the percentages written next to it in ink
 * colour, plus a legend for the bands (opacity steps) and the domains (colour + short label).
 */
export function bandFigure(items: FigureItem[], bands: string[], fmt: Fmt, opts: { width?: number; title?: string; ink?: string; muted?: string; surface?: string } = {}): string {
  const W = opts.width ?? 760;
  const ink = opts.ink ?? '#1f2430';
  const muted = opts.muted ?? '#5d6475';
  const surface = opts.surface ?? '#ffffff';
  const labelW = 210;
  const chip = 16;
  const numW = 150;
  const barW = W - labelW - chip - numW - 24;
  const rowH = 14;
  const rowGap = 4;
  const blockGap = 14;
  const domains = items[0]?.rows ?? [];
  const legendH = 46;
  const out: string[] = [];
  let y = 0;
  if (opts.title) {
    out.push(`<text x="${W}" y="16" text-anchor="end" font-size="14" font-weight="700" fill="${ink}">${esc(opts.title)}</text>`);
    y = 26;
  }
  // legend: bands (neutral swatches with the same opacity steps) and domains
  let lx = W;
  out.push(`<text x="${lx}" y="${y + 12}" text-anchor="end" font-size="11" fill="${muted}">طبقه‌ها:</text>`);
  lx -= 52;
  bands.forEach((b, i) => {
    out.push(`<rect x="${lx - 14}" y="${y + 3}" width="14" height="12" rx="2" fill="${ink}" fill-opacity="${bandOpacity(i, bands.length).toFixed(2)}"/>`);
    out.push(`<text x="${lx - 18}" y="${y + 12}" text-anchor="end" font-size="11" fill="${ink}">${esc(b)}</text>`);
    lx -= 30 + b.length * 6.2;
  });
  lx = W;
  out.push(`<text x="${lx}" y="${y + 34}" text-anchor="end" font-size="11" fill="${muted}">حوزه‌ها:</text>`);
  lx -= 52;
  domains.forEach((d) => {
    out.push(`<rect x="${lx - 16}" y="${y + 24}" width="16" height="14" rx="3" fill="${d.color}"/>`);
    out.push(`<text x="${lx - 8}" y="${y + 31.5}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="#fff">${esc(d.short)}</text>`);
    out.push(`<text x="${lx - 20}" y="${y + 34}" text-anchor="end" font-size="11" fill="${ink}">${esc(d.name)}</text>`);
    lx -= 40 + d.name.length * 6.2;
  });
  y += legendH;
  for (const it of items) {
    const blockH = it.rows.length * (rowH + rowGap) - rowGap;
    out.push(`<text x="${W}" y="${y + 11}" text-anchor="end" font-size="12" font-weight="700" fill="${ink}">${esc(it.code)} — ${esc(truncate(it.name, 34))}</text>`);
    it.rows.forEach((r, ri) => {
      const ry = y + ri * (rowH + rowGap);
      const cx = W - labelW;
      out.push(`<rect x="${cx - chip}" y="${ry}" width="${chip}" height="${rowH}" rx="3" fill="${r.color}"/>`);
      out.push(`<text x="${cx - chip / 2}" y="${ry + rowH / 2 + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="#fff">${esc(r.short)}</text>`);
      const right = cx - chip - 6;
      if (!r.n) {
        out.push(`<rect x="${right - barW}" y="${ry}" width="${barW}" height="${rowH}" rx="2" fill="none" stroke="${muted}" stroke-dasharray="3 2"/>`);
      } else {
        let x = right;
        r.percents.forEach((pc, bi) => {
          const w = ((pc ?? 0) / 100) * barW;
          if (w <= 0) return;
          x -= w;
          out.push(`<rect x="${x + 1}" y="${ry}" width="${Math.max(0, w - 2)}" height="${rowH}" rx="2" fill="${r.color}" fill-opacity="${bandOpacity(bi, bands.length).toFixed(2)}" stroke="${surface}" stroke-width="0"/>`);
        });
      }
      const txt = r.n ? `${r.percents.map((pc) => fmt.int(Math.round(pc ?? 0))).join(' · ')}٪  (n=${fmt.int(r.n)})` : 'بدون پاسخ معتبر';
      out.push(`<text x="${right - barW - 6}" y="${ry + rowH - 3}" text-anchor="end" font-size="10.5" fill="${muted}">${esc(txt)}</text>`);
    });
    y += Math.max(blockH, 14) + blockGap;
  }
  const H = y;
  return `<svg xmlns="http://www.w3.org/2000/svg" style="direction:ltr" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Vazirmatn, Tahoma, sans-serif" role="img" aria-label="${esc(opts.title ?? 'توزیع پاسخ‌ها در طبقه‌ها به تفکیک حوزه')}"><rect width="${W}" height="${H}" fill="${surface}"/>${out.join('')}</svg>`;
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
