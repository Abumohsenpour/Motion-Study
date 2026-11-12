/**
 * Every chart of the project for the thesis chapter, in Persian or English: SVG (with the font embedded, so it
 * renders anywhere) and PNG at 2× resolution. Both language versions are drawn by the same code from the same
 * numbers; only the texts and the reading direction differ.
 */
import fontUrl from 'vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2?inline';
import { projectWeights, round2Analysis, roundStats, weightedAnalysis, type ParamStats, type Project } from '../core';
import { tr, type Lang } from '../i18n';
import type { Fmt } from '../ui/format';
import { bandFigure, type BandRow, type FigureItem } from './bandChart';
import { chartLabels, type Labels } from './labels';
import { consensusChart, scoreChart, weightsChart } from './scoreChart';

export interface ChartItem {
  key: string;
  title: string;
  svg: string;
}

/** Rows of a band figure for one parameter, with names in the chart's language. */
export function figureItem(p: Project, s: ParamStats, L: Labels): FigureItem {
  const rows: BandRow[] = p.domains.map((d) => {
    const b = s.byDomain[d.id];
    return { short: L.domainShort(d.id), name: L.domain(d.id), color: d.color, n: b.n, counts: b.counts, percents: b.percents };
  });
  return { code: s.param.code, name: L.param(s.param.id), rows, overall: { n: s.overall.n, counts: s.overall.counts, percents: s.overall.percents } };
}

export function chartCatalog(p: Project, fmt: Fmt, lang: Lang = 'fa'): ChartItem[] {
  const out: ChartItem[] = [];
  const L = chartLabels(p, lang);
  const T = (fa: string, v?: Record<string, string | number>) => tr(lang, fa, v);
  const bands = p.scale.bands.map((_, i) => L.band(i));
  const top = p.scale.bands.length - 1;
  const stats: Partial<Record<'r1' | 'r2', ParamStats[]>> = {};
  for (const round of ['r1', 'r2'] as const) {
    try {
      const st = roundStats(p, round);
      if (st.some((s) => s.overall.n > 0)) stats[round] = st;
    } catch {
      /* no data */
    }
  }
  const subtitle = T('درصد پاسخ‌های معتبر هر حوزه در هر طبقه مقیاس؛ n = تعداد پاسخ معتبر');
  for (const round of ['r1', 'r2'] as const) {
    const st = stats[round];
    if (!st) continue;
    for (const g of p.groups) {
      const items = st.filter((s) => s.param.groupId === g.id);
      if (!items.length) continue;
      const title = T(round === 'r1' ? 'توزیع پاسخ‌های دور اول — {group}' : 'توزیع پاسخ‌های دور دوم — {group}', { group: L.group(g.id) });
      out.push({
        key: `${round}-${g.id}`,
        title,
        svg: bandFigure(items.map((s) => figureItem(p, s, L)), bands, fmt, { lang, title, subtitle, threshold: round === 'r2' ? p.settings.consensus.retainTopMin : undefined }),
      });
    }
  }
  if (stats.r2) {
    try {
      const r1 = new Map((stats.r1 ?? []).map((s) => [s.param.id, s]));
      const title = T('اجماع پارامترها: سهم طبقه بالا در دور اول و دوم');
      out.push({
        key: 'consensus',
        title,
        svg: consensusChart(
          round2Analysis(p).map((r) => {
            const a = r1.get(r.param.id);
            return { code: r.param.code, name: L.param(r.param.id), r1Top: a && a.overall.n ? a.overall.percents[top] : null, r2Top: r.overall.n ? r.overall.percents[top] : null, status: r.consensus.status };
          }),
          fmt,
          { lang, title, subtitle: T('وضعیت اجماع طبق معیار ازپیش‌تعیین‌شده، فقط از پاسخ‌های دور دوم'), threshold: p.settings.consensus.retainTopMin, topBand: L.band(top) },
        ),
      });
    } catch {
      /* not enough data */
    }
  }
  try {
    const w = projectWeights(p);
    if (w.retainedParams.length && w.domainsUsed.length) {
      const items = w.retainedParams
        .map((id) => {
          const x = p.params.find((q) => q.id === id)!;
          return { code: x.code, name: L.param(id), group: L.group(x.groupId), w: w.final[id], q1: w.agreement[id].q1, q3: w.agreement[id].q3 };
        })
        .sort((a, b) => b.w - a.w);
      const title = T('وزن نهایی پارامترهای مورد اجماع');
      out.push({ key: 'weights', title, svg: weightsChart(items, fmt, { lang, title, subtitle: T('به ترتیب وزن؛ مجموع وزن‌ها ۱۰۰٪') }) });
    }
    const a = weightedAnalysis(p, w.final);
    if (a.result.ranking.length) {
      const title = T('امتیاز وزنی کانسپت‌ها');
      const name = (id: string) => [p.concepts.find((c) => c.id === id)?.code, L.concept(id)].filter(Boolean).join(' — ');
      out.push({
        key: 'weighted',
        title,
        svg: scoreChart(a.result.ranking.map((r) => ({ label: name(r.id), score: r.score, rank: r.rank })), fmt, { lang, title, subtitle: T('ماتریس پیو وزن‌دار؛ عدد داخل نشان = رتبه') }),
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
