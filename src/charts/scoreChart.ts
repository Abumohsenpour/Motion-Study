/**
 * Horizontal bar chart of the weighted scores (relation ۸), one series, sorted by rank.
 * Value labels are written in ink colour next to each bar; the axis runs over the 1–5 value scale.
 */
import type { Fmt } from '../ui/format';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function scoreChart(items: { label: string; score: number; rank: number }[], fmt: Fmt, opts: { width?: number; title?: string; color?: string; ink?: string; muted?: string; surface?: string } = {}): string {
  const W = opts.width ?? 640;
  const ink = opts.ink ?? '#1f2430';
  const muted = opts.muted ?? '#5d6475';
  const surface = opts.surface ?? '#ffffff';
  const color = opts.color ?? '#34507a';
  const labelW = 190;
  const valueW = 70;
  const barMax = W - labelW - valueW - 10;
  const rowH = 26;
  const top = opts.title ? 30 : 8;
  const H = top + items.length * rowH + 28;
  const x0 = W - labelW; // right edge of the bars (RTL: bars grow leftwards from the label column)
  const sx = (v: number) => ((v - 1) / 4) * barMax;
  const out: string[] = [];
  if (opts.title) out.push(`<text x="${W}" y="18" text-anchor="end" font-size="14" font-weight="700" fill="${ink}">${esc(opts.title)}</text>`);
  for (let t = 1; t <= 5; t++) {
    const x = x0 - sx(t);
    out.push(`<line x1="${x}" y1="${top - 4}" x2="${x}" y2="${top + items.length * rowH}" stroke="${muted}" stroke-opacity=".25"/>`);
    out.push(`<text x="${x}" y="${top + items.length * rowH + 16}" text-anchor="middle" font-size="11" fill="${muted}">${fmt.int(t)}</text>`);
  }
  items.forEach((it, i) => {
    const y = top + i * rowH;
    const w = Math.max(0, sx(it.score));
    out.push(`<text x="${W}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="12" fill="${ink}">${fmt.int(it.rank)}. ${esc(it.label)}</text>`);
    out.push(`<rect x="${x0 - w}" y="${y + 5}" width="${w}" height="${rowH - 10}" rx="4" fill="${color}" fill-opacity="${i === 0 ? 1 : 0.65}"><title>${esc(it.label)}: ${fmt.num(it.score, 3)}</title></rect>`);
    out.push(`<text x="${x0 - w - 6}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="12" font-weight="700" fill="${ink}">${fmt.num(it.score, 3)}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" style="direction:ltr" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Vazirmatn, Tahoma, sans-serif" role="img" aria-label="${esc(opts.title ?? 'امتیاز وزنی کانسپت‌ها')}"><rect width="${W}" height="${H}" fill="${surface}"/>${out.join('')}</svg>`;
}
