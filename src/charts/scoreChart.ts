/**
 * Result figures of the study, one series each:
 *  - scoreChart      weighted scores of the concepts (relation ۸) on the 1–5 value scale;
 *  - weightsChart    final weights Wᵢ with the interquartile range of the individual weights;
 *  - consensusChart  share of answers in the top band per parameter, round 1 → round 2, against the threshold.
 * Values are written next to the marks in ink colour; status colours always come with a written status.
 */
import { currentLang, statusLabel, tr, type Lang } from '../i18n';
import type { Fmt } from '../ui/format';
import { Canvas, THEME, heading, textWidth, truncate } from './svg';

interface CommonOpts {
  lang?: Lang;
  width?: number;
  title?: string;
  subtitle?: string;
}

export function scoreChart(
  items: { label: string; score: number; rank: number }[],
  fmt: Fmt,
  opts: CommonOpts & { color?: string; ink?: string; muted?: string; surface?: string } = {},
): string {
  const lang = opts.lang ?? currentLang();
  const W = opts.width ?? 760;
  const pad = 22;
  const c = new Canvas(lang, W);
  // on screen the chart follows the page colours; exported figures use the fixed theme
  const ink = opts.ink ?? THEME.ink;
  const muted = opts.muted ?? THEME.muted;
  const labelW = 300;
  const valueW = 58;
  const x0 = pad + 30 + labelW;
  const barW = W - pad - valueW - x0;
  const rowH = 34;
  const sx = (v: number) => ((Math.min(5, Math.max(1, v)) - 1) / 4) * barW;
  let y = heading(c, pad, opts.title, opts.subtitle) + 4;
  const bodyH = items.length * rowH;
  for (let tick = 1; tick <= 5; tick++) {
    const x = x0 + sx(tick);
    c.line(x, y, x, y + bodyH, { stroke: muted, opacity: 0.22 });
    c.text(x, y + bodyH + 16, fmt.int(tick), { size: 11, fill: muted, anchor: 'middle' });
  }
  items.forEach((it, i) => {
    const ry = y + i * rowH;
    const best = it.rank === 1;
    c.chip(pad, ry + 7, 22, 20, fmt.int(it.rank), best ? (opts.color ?? THEME.brand) : THEME.neutral);
    c.text(pad + 30, ry + 21.5, truncate(it.label, 44), { size: 12.5, weight: best ? 700 : 400, fill: ink });
    c.rect(x0, ry + 8, barW, 18, { fill: muted, opacity: 0.1, rx: 4 });
    c.rect(x0, ry + 8, Math.max(2, sx(it.score)), 18, { fill: opts.color ?? THEME.brand, opacity: best ? 1 : 0.45, rx: 4, title: `${it.label}: ${fmt.num(it.score, 3)}` });
    c.text(x0 + barW + 10, ry + 21.5, fmt.num(it.score, 3), { size: 12.5, weight: 700, fill: ink });
  });
  y += bodyH + 26;
  c.text(x0 + barW / 2, y + 8, tr(lang, 'امتیاز وزنی (مقیاس ۱ تا ۵)'), { size: 10.5, fill: muted, anchor: 'middle' });
  const svg = c.svg(y + 14 + pad / 2, opts.title ?? tr(lang, 'امتیاز وزنی کانسپت‌ها'));
  return opts.surface ? svg.replace(`fill="${THEME.surface}"`, `fill="${opts.surface}"`) : svg;
}

export interface WeightItem {
  code: string;
  name: string;
  group: string;
  w: number;
  q1: number | null;
  q3: number | null;
}

/** Final weights (bars, in percent of the total) with the IQR of the individual weights (whiskers), by weight. */
export function weightsChart(items: WeightItem[], fmt: Fmt, opts: CommonOpts = {}): string {
  const lang = opts.lang ?? 'fa';
  const T = (fa: string) => tr(lang, fa);
  const W = opts.width ?? 820;
  const pad = 22;
  const c = new Canvas(lang, W);
  const labelW = 280;
  const groupW = 96;
  const x0 = pad + 26 + labelW + groupW;
  const valueW = 50;
  const barW = W - pad - valueW - x0;
  const rowH = 24;
  const max = Math.max(0.0001, ...items.map((x) => Math.max(x.w, x.q3 ?? 0)));
  // axis up to a round percent above the largest value
  const top = Math.ceil(max * 100 + 0.5);
  const sx = (v: number) => ((v * 100) / top) * barW;
  let y = heading(c, pad, opts.title, opts.subtitle);
  c.rect(pad, y, 14, 12, { fill: THEME.brand, rx: 3 });
  const l1 = T('وزن نهایی Wᵢ (٪ از کل)');
  c.text(pad + 20, y + 10, l1, { size: 11 });
  const lx = pad + 20 + textWidth(l1, 11) + 22;
  c.line(lx, y + 6, lx + 22, y + 6, { stroke: THEME.ink, width: 2 });
  c.line(lx, y + 2, lx, y + 10, { stroke: THEME.ink, width: 2 });
  c.line(lx + 22, y + 2, lx + 22, y + 10, { stroke: THEME.ink, width: 2 });
  c.text(lx + 29, y + 10, T('دامنه بین چارکی وزن‌های فردی (Q1–Q3)'), { size: 11 });
  y += 38;
  const bodyH = items.length * rowH;
  const step = top <= 6 ? 1 : top <= 12 ? 2 : 5;
  for (let tick = 0; tick <= top; tick += step) {
    const x = x0 + (tick / top) * barW;
    c.line(x, y - 4, x, y + bodyH, { stroke: THEME.grid });
    c.text(x, y - 9, fmt.pct(tick, 0), { size: 10, fill: THEME.faint, anchor: 'middle' });
  }
  items.forEach((it, i) => {
    const ry = y + i * rowH;
    if (i % 2 === 1) c.rect(pad - 6, ry, W - 2 * pad + 12, rowH, { fill: THEME.track, opacity: 0.6, rx: 4 });
    c.text(pad, ry + 16, fmt.int(i + 1), { size: 10.5, fill: THEME.faint });
    c.text(pad + 26, ry + 16, it.code, { size: 11.5, weight: 700, ltr: true });
    c.text(pad + 26 + 36, ry + 16, truncate(it.name, 34), { size: 11.5 });
    c.text(pad + 26 + labelW, ry + 16, truncate(it.group, 14), { size: 10.5, fill: THEME.muted });
    c.rect(x0, ry + 5, Math.max(2, sx(it.w)), rowH - 10, { fill: THEME.brand, rx: 3, title: `${it.code}: ${fmt.num(it.w, 4)}` });
    if (it.q1 !== null && it.q3 !== null) {
      const a = x0 + sx(it.q1);
      const b = x0 + sx(it.q3);
      const my = ry + rowH / 2;
      c.line(a, my, b, my, { stroke: THEME.ink, width: 1.6 });
      c.line(a, my - 4, a, my + 4, { stroke: THEME.ink, width: 1.6 });
      c.line(b, my - 4, b, my + 4, { stroke: THEME.ink, width: 1.6 });
    }
    c.text(W - pad, ry + 16, fmt.pct(it.w * 100, 1), { size: 11.5, weight: 700, anchor: 'end' });
  });
  return c.svg(y + bodyH + pad, opts.title ?? T('وزن نهایی پارامترهای مورد اجماع'));
}

export interface ConsensusItem {
  code: string;
  name: string;
  /** Percent of valid answers in the top band; null when the parameter was not in that round. */
  r1Top: number | null;
  r2Top: number | null;
  status: 'retain' | 'remove' | 'none';
}

/** Top-band share per parameter in round 1 (hollow) and round 2 (filled), with the retain threshold. */
export function consensusChart(items: ConsensusItem[], fmt: Fmt, opts: CommonOpts & { threshold: number; topBand: string }): string {
  const lang = opts.lang ?? 'fa';
  const T = (fa: string, v?: Record<string, string | number>) => tr(lang, fa, v);
  const W = opts.width ?? 820;
  const pad = 22;
  const c = new Canvas(lang, W);
  const labelW = 250;
  const statusW = 104;
  const x0 = pad + labelW + 10;
  const plotW = W - pad - statusW - x0 - 10;
  const rowH = 22;
  const sx = (pc: number) => x0 + (pc / 100) * plotW;
  const col = { retain: THEME.ok, remove: THEME.bad, none: THEME.neutral };
  const word = { retain: statusLabel('retain', lang), remove: statusLabel('remove', lang), none: statusLabel('none', lang) };
  const mark = { retain: '✓', remove: '✕', none: '–' };
  let y = heading(c, pad, opts.title, opts.subtitle);
  // legend
  c.circle(pad + 6, y + 6, 4.5, { fill: THEME.surface, stroke: THEME.neutral });
  const l1 = T('دور اول');
  c.text(pad + 16, y + 10, l1, { size: 11 });
  let lx = pad + 16 + textWidth(l1, 11) + 20;
  c.circle(lx + 6, y + 6, 5, { fill: THEME.neutral });
  const l2 = T('دور دوم (رنگ = وضعیت اجماع)');
  c.text(lx + 16, y + 10, l2, { size: 11 });
  lx += 16 + textWidth(l2, 11) + 20;
  c.line(lx + 4, y - 2, lx + 4, y + 14, { stroke: THEME.ink, width: 1.5, dash: '4 3' });
  c.text(lx + 12, y + 10, T('آستانه «حفظ»: {n}', { n: fmt.pct(opts.threshold, 0) }), { size: 11 });
  y += 40;
  const bodyH = items.length * rowH;
  for (const tick of [0, 25, 50, 75, 100]) {
    c.line(sx(tick), y - 4, sx(tick), y + bodyH, { stroke: THEME.grid });
    c.text(sx(tick), y - 9, fmt.pct(tick, 0), { size: 10, fill: THEME.faint, anchor: 'middle' });
  }
  c.line(sx(opts.threshold), y - 4, sx(opts.threshold), y + bodyH, { stroke: THEME.ink, width: 1.5, dash: '4 3' });
  items.forEach((it, i) => {
    const ry = y + i * rowH;
    const my = ry + rowH / 2;
    if (i % 2 === 1) c.rect(pad - 6, ry, W - 2 * pad + 12, rowH, { fill: THEME.track, opacity: 0.6, rx: 4 });
    c.text(pad, ry + 15, it.code, { size: 11.5, weight: 700, ltr: true });
    c.text(pad + 36, ry + 15, truncate(it.name, 38), { size: 11.5 });
    if (it.r2Top !== null) {
      if (it.r1Top !== null) {
        c.line(sx(it.r1Top), my, sx(it.r2Top), my, { stroke: col[it.status], width: 2, opacity: 0.55 });
        c.circle(sx(it.r1Top), my, 4.5, { fill: THEME.surface, stroke: THEME.neutral, title: `${it.code} — ${l1}: ${fmt.pct(it.r1Top, 1)}` });
      }
      c.circle(sx(it.r2Top), my, 5.5, { fill: col[it.status], stroke: THEME.surface, width: 2, title: `${it.code}: ${fmt.pct(it.r2Top, 1)}` });
      c.text(W - pad - statusW + 34, ry + 15, fmt.pct(it.r2Top, 0), { size: 11, fill: THEME.muted, anchor: 'end' });
    }
    c.text(W - pad - statusW + 42, ry + 15, `${mark[it.status]} ${word[it.status]}`, { size: 11, weight: 700, fill: col[it.status] });
  });
  y += bodyH + 18;
  c.text(x0 + plotW / 2, y + 6, T('سهم پاسخ‌های معتبر در طبقه «{band}»', { band: opts.topBand }), { size: 10.5, fill: THEME.muted, anchor: 'middle' });
  return c.svg(y + 12 + pad / 2, opts.title ?? T('اجماع پارامترها'));
}
