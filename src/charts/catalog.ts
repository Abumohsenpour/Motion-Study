/**
 * Every chart of the project, for the thesis chapter: SVG (with the font embedded, so it renders anywhere) and
 * PNG at 2× resolution.
 */
import fontUrl from 'vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2?inline';
import { projectWeights, roundStats, weightedAnalysis, type Project } from '../core';
import type { Fmt } from '../ui/format';
import { bandRows } from '../report/delphiSections';
import { bandFigure } from './bandChart';
import { scoreChart } from './scoreChart';

export interface ChartItem {
  key: string;
  title: string;
  svg: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Final weights Wᵢ (bars) with the IQR of the individual weights (whiskers), sorted by weight. */
export function weightsChart(items: { code: string; name: string; w: number; q1: number | null; q3: number | null }[], fmt: Fmt, title?: string): string {
  const W = 720;
  const labelW = 230;
  const valueW = 64;
  const rowH = 22;
  const top = (title ? 30 : 6) + 22;
  const max = Math.max(0.0001, ...items.map((x) => Math.max(x.w, x.q3 ?? 0)));
  const barMax = W - labelW - valueW - 10;
  const x0 = W - labelW;
  const sx = (v: number) => (v / max) * barMax;
  const H = top + items.length * rowH + 10;
  const ink = '#1f2430';
  const muted = '#5d6475';
  const out: string[] = [];
  if (title) out.push(`<text x="${W}" y="18" text-anchor="end" font-size="14" font-weight="700" fill="${ink}">${esc(title)}</text>`);
  const ly = (title ? 30 : 6) + 6;
  out.push(`<rect x="${W - 14}" y="${ly}" width="14" height="10" rx="2" fill="#34507a"/><text x="${W - 20}" y="${ly + 9}" text-anchor="end" font-size="11" fill="${ink}">وزن نهایی Wᵢ</text>`);
  out.push(`<line x1="${W - 140}" y1="${ly + 5}" x2="${W - 120}" y2="${ly + 5}" stroke="${ink}" stroke-width="2"/><text x="${W - 146}" y="${ly + 9}" text-anchor="end" font-size="11" fill="${ink}">دامنه بین چارکی وزن‌های فردی (Q1–Q3)</text>`);
  items.forEach((it, i) => {
    const y = top + i * rowH;
    out.push(`<text x="${W}" y="${y + 15}" text-anchor="end" font-size="11.5" fill="${ink}">${esc(it.code)} — ${esc(it.name.length > 26 ? it.name.slice(0, 25) + '…' : it.name)}</text>`);
    out.push(`<rect x="${x0 - sx(it.w)}" y="${y + 4}" width="${sx(it.w)}" height="${rowH - 8}" rx="3" fill="#34507a" fill-opacity=".85"/>`);
    if (it.q1 !== null && it.q3 !== null) {
      const a = x0 - sx(it.q1);
      const b = x0 - sx(it.q3);
      out.push(`<line x1="${a}" y1="${y + rowH / 2}" x2="${b}" y2="${y + rowH / 2}" stroke="${ink}" stroke-width="2"/><line x1="${a}" y1="${y + 6}" x2="${a}" y2="${y + rowH - 6}" stroke="${ink}" stroke-width="2"/><line x1="${b}" y1="${y + 6}" x2="${b}" y2="${y + rowH - 6}" stroke="${ink}" stroke-width="2"/>`);
    }
    out.push(`<text x="${Math.min(x0 - sx(it.w), x0 - sx(it.q3 ?? 0)) - 6}" y="${y + 15}" text-anchor="end" font-size="11" fill="${muted}">${fmt.num(it.w, 4)}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" style="direction:ltr" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Vazirmatn, Tahoma, sans-serif" role="img" aria-label="${esc(title ?? 'وزن نهایی پارامترها')}"><rect width="${W}" height="${H}" fill="#ffffff"/>${out.join('')}</svg>`;
}

export function chartCatalog(p: Project, fmt: Fmt): ChartItem[] {
  const out: ChartItem[] = [];
  const bands = p.scale.bands.map((b) => b.label);
  for (const round of ['r1', 'r2'] as const) {
    let stats: ReturnType<typeof roundStats> = [];
    try {
      stats = roundStats(p, round);
    } catch {
      /* no data */
    }
    if (!stats.some((s) => s.overall.n > 0)) continue;
    for (const g of p.groups) {
      const items = stats.filter((s) => s.param.groupId === g.id);
      if (!items.length) continue;
      const title = `توزیع پاسخ‌های ${round === 'r1' ? 'دور اول' : 'دور دوم'} به تفکیک حوزه — ${g.name}`;
      out.push({ key: `${round}-${g.id}`, title, svg: bandFigure(items.map((s) => ({ code: s.param.code, name: s.param.name, rows: bandRows(p, s) })), bands, fmt, { title }) });
    }
  }
  try {
    const w = projectWeights(p);
    if (w.retainedParams.length && w.domainsUsed.length) {
      const items = w.retainedParams
        .map((id) => {
          const x = p.params.find((q) => q.id === id)!;
          return { code: x.code, name: x.name, w: w.final[id], q1: w.agreement[id].q1, q3: w.agreement[id].q3 };
        })
        .sort((a, b) => b.w - a.w);
      const title = 'وزن نهایی پارامترهای مورد اجماع';
      out.push({ key: 'weights', title, svg: weightsChart(items, fmt, title) });
    }
    const a = weightedAnalysis(p, w.final);
    if (a.result.ranking.length) {
      const title = 'امتیاز وزنی کانسپت‌ها';
      out.push({
        key: 'weighted',
        title,
        svg: scoreChart(
          a.result.ranking.map((r) => ({ label: `${p.concepts.find((c) => c.id === r.id)?.code} — ${p.concepts.find((c) => c.id === r.id)?.name}`, score: r.score, rank: r.rank })),
          fmt,
          { title },
        ),
      });
    }
  } catch {
    /* no weights yet */
  }
  return out;
}

/** Standalone SVG: the font is embedded so the file renders identically in Word, Inkscape or a browser. */
export function standaloneSvg(svg: string): string {
  return svg.replace(/^<svg([^>]*)>/, `<svg$1><defs><style>@font-face{font-family:'Vazirmatn';src:url(${fontUrl}) format('woff2');font-weight:100 900}</style></defs>`);
}

export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const full = standaloneSvg(svg);
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(full);
  const w = m ? Number(m[1]) : 800;
  const h = m ? Number(m[2]) : 600;
  const url = URL.createObjectURL(new Blob([full], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    // give the embedded font a moment to be applied inside the image
    await new Promise((r) => setTimeout(r, 120));
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
