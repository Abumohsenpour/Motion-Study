/**
 * Report sections for Part A (used by the round-1 report and the thesis report). Experts appear by code only.
 */
import {
  candidateRows,
  codeOf,
  openAnswers,
  panelDescription,
  responseRates,
  roundStats,
  type BandStats,
  type ParamStats,
  type Project,
} from '../core';
import { bandFigure, type BandRow } from '../charts/bandChart';
import type { Fmt } from '../ui/format';
import { escapeHtml, type Cell, type ReportBuilder } from './html';

export function bandRows(p: Project, s: ParamStats): BandRow[] {
  return p.domains.map((d) => {
    const b = s.byDomain[d.id];
    return { short: d.shortLabel, name: d.name, color: d.color, n: b.n, counts: b.counts, percents: b.percents };
  });
}

/** "7 (5.25–9)" */
export const medianIqr = (fmt: Fmt, q: { median: number | null; q1: number | null; q3: number | null }) =>
  q.median === null ? '—' : `${fmt.auto(q.median, 2)} (${fmt.auto(q.q1, 2)}–${fmt.auto(q.q3, 2)})`;

/** "7 (77.8٪)" per band */
export const bandCells = (fmt: Fmt, b: BandStats): Cell[] => b.counts.map((c, i) => `${fmt.int(c)} (${fmt.pct(b.percents[i], 1)})`);

export const chip = (p: Project, domainId: string): Cell => {
  const d = p.domains.find((x) => x.id === domainId);
  return d ? { html: `<span class="chip" style="background:${escapeHtml(d.color)}">${escapeHtml(d.shortLabel)}</span> ${escapeHtml(d.name)}` } : '—';
};

export function panelSection(r: ReportBuilder, p: Project) {
  const fmt = r.fmt;
  const d = panelDescription(p);
  const rates = responseRates(p);
  const edges = d.edges;
  const binLabels = [`کمتر از ${fmt.int(edges[0])}`, ...edges.map((e, i) => (i < edges.length - 1 ? `${fmt.int(e)} تا ${fmt.int(edges[i + 1] - 1)}` : `${fmt.int(e)} و بیشتر`))];
  r.h2('توصیف پنل و نرخ پاسخ');
  r.p('ویژگی‌های پنل (پاسخ‌دهندگان دور اول) تنها به‌صورت تجمیعی و در قالب دامنه گزارش می‌شود؛ مقادیر فردی، کمینه و بیشینه گزارش نمی‌شود.');
  const total = d.overall.n;
  r.table(
    'panel-domain',
    'ترکیب پنل به تفکیک حوزه تخصصی و سابقه کار',
    ['حوزه', 'تعداد', 'درصد', 'سابقه کار: میانه (Q1–Q3)', ...binLabels.map((b) => `سابقه ${b} سال`)],
    [
      ...p.domains.map((dm) => {
        const x = d.byDomain[dm.id];
        return [chip(p, dm.id), fmt.int(x.n), fmt.pct(total ? (100 * x.n) / total : null), medianIqr(fmt, x.experience), ...x.experienceBins.map((c) => fmt.int(c))];
      }),
      [{ html: '<b>کل</b>' }, fmt.int(total), fmt.pct(total ? 100 : null), medianIqr(fmt, d.overall.experience), ...d.overall.experienceBins.map((c) => fmt.int(c))],
    ],
  );
  r.table(
    'panel-activity',
    'نوع فعالیت اعضای پنل',
    ['نوع فعالیت', 'تعداد', 'درصد'],
    d.overall.activity.map((a) => [a.value, fmt.int(a.count), fmt.pct(total ? (100 * a.count) / total : null)]),
  );
  const rate = (x: { invited: number; respondents: number; rate: number | null }) => `${fmt.int(x.respondents)} از ${fmt.int(x.invited)} (${fmt.pct(x.rate === null ? null : 100 * x.rate)})`;
  r.table(
    'response-rates',
    'نرخ پاسخ و افت در هر دور',
    ['حوزه', 'دور اول', 'دور دوم', 'افت از دور اول به دوم'],
    [
      ...p.domains.map((dm) => {
        const x = rates.byDomain[dm.id];
        return [chip(p, dm.id), rate(x.r1), rate(x.r2), fmt.pct(x.attrition === null ? null : 100 * x.attrition)];
      }),
      [{ html: '<b>کل</b>' }, rate(rates.overall.r1), rate(rates.overall.r2), fmt.pct(rates.overall.attrition === null ? null : 100 * rates.overall.attrition)],
    ],
  );
}

/** Overall descriptives per parameter, then per-domain detail, then domain-coloured figures per group. */
export function roundStatsSection(r: ReportBuilder, p: Project, round: 'r1' | 'r2', opts: { withConsensus?: boolean; withFigures?: boolean } = {}) {
  const fmt = r.fmt;
  const stats = roundStats(p, round);
  const bands = p.scale.bands.map((b) => `${b.label} (${fmt.int(b.from)}–${fmt.int(b.to)})`);
  const rn = round === 'r1' ? 'دور اول' : 'دور دوم';
  r.table(
    `${round}-overall`,
    `توصیف امتیازهای ${rn} برای هر پارامتر (کل پنل)`,
    ['کد', 'پارامتر', 'n معتبر', p.scale.cannotJudgeLabel, 'میانه (Q1–Q3)', 'IQR', ...bands],
    stats.map((s) => [
      { html: `<span class="ltr">${escapeHtml(s.param.code)}</span>` },
      { html: `<div style="text-align:right">${escapeHtml(s.param.name)}${s.param.origin === 'round2' ? ' <b>(جدید)</b>' : ''}</div>` },
      fmt.int(s.overall.n),
      fmt.int(s.overall.nCannotJudge),
      medianIqr(fmt, s.overall),
      fmt.auto(s.overall.iqr, 2),
      ...bandCells(fmt, s.overall),
    ]),
    { small: true, footnote: 'درصدها از پاسخ‌های معتبر است؛ «توانایی قضاوت ندارم» و پاسخ خالی از مخرج حذف شده‌اند. چارک‌ها به روش نوع ۷ (معادل QUARTILE.INC در Excel).' },
  );
  r.table(
    `${round}-domain`,
    `توصیف امتیازهای ${rn} به تفکیک حوزه تخصصی`,
    ['کد', 'حوزه', 'n معتبر', 'میانه (Q1–Q3)', ...bands],
    stats.flatMap((s) =>
      p.domains.map((d, i) => [
        i === 0 ? { html: `<span class="ltr">${escapeHtml(s.param.code)}</span>` } : '',
        chip(p, d.id),
        fmt.int(s.byDomain[d.id].n),
        medianIqr(fmt, s.byDomain[d.id]),
        ...bandCells(fmt, s.byDomain[d.id]),
      ]),
    ),
    { small: true },
  );
  if (opts.withFigures !== false) {
    for (const g of p.groups) {
      const items = stats.filter((s) => s.param.groupId === g.id);
      if (!items.length) continue;
      r.figure(
        `${round}-fig-${g.id}`,
        `توزیع پاسخ‌های ${rn} در طبقه‌های مقیاس به تفکیک حوزه — گروه «${g.name}»`,
        bandFigure(
          items.map((s) => ({ code: s.param.code, name: s.param.name, rows: bandRows(p, s) })),
          p.scale.bands.map((b) => b.label),
          fmt,
        ),
      );
    }
  }
}

export function openAnswersSection(r: ReportBuilder, p: Project) {
  const fmt = r.fmt;
  const answers = openAnswers(p);
  const cands = new Map(p.candidates.map((c) => [c.id, c.label]));
  r.h2('پاسخ‌های باز دور اول و پارامترهای پیشنهادی');
  if (!answers.length) {
    r.p('پاسخ بازی ثبت نشده است.');
  } else {
    r.table(
      'open-answers',
      'پاسخ‌های باز دور اول و کدگذاری آن‌ها',
      ['خبره', 'گروه معنایی', 'متن (ویرایش‌شده برای حذف جزئیات هویت‌بخش)', 'کدگذاری'],
      answers.map((a) => [
        { html: `<span class="ltr">${escapeHtml(codeOf(p, a.expertId))}</span>` },
        p.groups.find((g) => g.id === a.groupId)?.name ?? '',
        { html: `<div style="text-align:right">${escapeHtml(a.coding?.displayText ?? a.text)}</div>` },
        a.coding?.commentOnly
          ? 'توضیح'
          : [...(a.coding?.candidateIds ?? []).map((c) => `نامزد: ${cands.get(c) ?? ''}`), ...(a.coding?.paramIds ?? []).map((id) => `پارامتر موجود: ${p.params.find((x) => x.id === id)?.code ?? ''}`)].join('؛ ') || '—',
      ]),
      { small: true },
    );
  }
  const rows = candidateRows(p).filter((c) => !c.merged);
  if (rows.length) {
    const merged = candidateRows(p).filter((c) => c.merged);
    r.table(
      'candidates',
      `پارامترهای نامزد و قاعده افزودن (دست‌کم ${fmt.int(p.settings.candidatePct)}٪ پاسخ‌دهندگان دور اول)`,
      ['نامزد', 'موارد هم‌معنای ادغام‌شده', 'خبرگان مطرح‌کننده (کد)', 'تعداد', 'حداقل لازم', 'نتیجه قاعده', 'تصمیم نهایی'],
      rows.map((c) => [
        { html: `<div style="text-align:right">${escapeHtml(c.candidate.label)}</div>` },
        merged.filter((m) => m.canonicalId === c.candidate.id).map((m) => m.candidate.label).join('، ') || '—',
        c.supporters.map((id) => codeOf(p, id)).sort().join('، '),
        fmt.int(c.supporters.length),
        fmt.int(c.minNeeded),
        c.meetsThreshold ? 'به آستانه رسید' : 'نرسید',
        c.overridden ? `${c.add ? 'افزوده شد' : 'افزوده نشد'} (تصمیم دستی: ${c.candidate.overrideReason || 'بدون دلیل ثبت‌شده'})` : c.add ? 'افزوده شد' : 'افزوده نشد',
      ]),
      { small: true },
    );
  }
}
