/** Report sections for round-2 consensus, weights (relations ۱–۵) and the design brief. */
import { codeOf, panelCheck, projectWeights, round2Analysis, type Project, type WeightsResult } from '../core';
import { escapeHtml, type Cell, type ReportBuilder } from './html';
import { bandCells, chip, medianIqr } from './delphiSections';

export const STATUS_FA = { retain: 'حفظ', remove: 'حذف', none: 'فاقد اجماع' } as const;

export const EXCLUSION_FA: Record<string, string> = {
  'no-allocation': 'توزیع امتیاز انجام نشده است',
  'group-level-blank': 'توزیع میان گروه‌ها خالی است',
  'within-group-blank': 'توزیع درون یک گروه دارای امتیاز خالی است',
  'zero-retained-group-points': 'به هیچ گروه دارای پارامتر حفظ‌شده امتیاز نداده است',
};

const ltr = (s: string): Cell => ({ html: `<span class="ltr">${escapeHtml(s)}</span>` });

export function consensusSection(r: ReportBuilder, p: Project) {
  const fmt = r.fmt;
  const rows = round2Analysis(p);
  const t = p.settings.consensus;
  const pc = panelCheck(p);
  r.h2('اجماع دور دوم');
  r.p(
    `معیار اجماع روی امتیازهای دور دوم اعمال شد: اجماع بر حفظ = دست‌کم ${fmt.int(t.retainTopMin)}٪ پاسخ‌های معتبر در طبقه بالا و حداکثر ${fmt.int(t.retainBottomMax)}٪ در طبقه پایین؛ اجماع بر حذف = دست‌کم ${fmt.int(t.removeBottomMin)}٪ در طبقه پایین و حداکثر ${fmt.int(t.removeTopMax)}٪ در طبقه بالا؛ سایر پارامترها فاقد اجماع‌اند. میانه و دامنه بین چارکی صرفاً توصیفی‌اند.`,
  );
  r.p(
    `حداقل نهایی پنل (${fmt.int(p.settings.panel.minTotal)} نفر و دست‌کم ${fmt.int(p.settings.panel.minPerDomain)} نفر از هر حوزه) پیش از تحلیل دور دوم بررسی شد: ${fmt.int(pc.total)} پاسخ‌دهنده (${p.domains
      .map((d) => `${d.name}: ${fmt.int(pc.perDomain[d.id])}`)
      .join('، ')}) — ${pc.ok ? 'برقرار است.' : 'برقرار نیست.'}`,
  );
  if (!pc.ok) r.note('حداقل نهایی پنل برقرار نیست؛ این موضوع باید در تفسیر نتایج و بخش محدودیت‌ها ذکر شود.', 'warn');
  const bands = p.scale.bands.map((b) => `${b.label} (${fmt.int(b.from)}–${fmt.int(b.to)})`);
  r.table(
    'consensus',
    'نتایج دور دوم و وضعیت اجماع هر پارامتر',
    ['کد', 'پارامتر', 'n معتبر', p.scale.cannotJudgeLabel, ...bands, 'میانه (Q1–Q3)', 'وضعیت اجماع'],
    rows.map((x) => [
      ltr(x.param.code),
      { html: `<div style="text-align:right">${escapeHtml(x.param.name)}${x.param.origin === 'round2' ? ' <b>(جدید)</b>' : ''}</div>` },
      fmt.int(x.overall.n),
      fmt.int(x.overall.nCannotJudge),
      ...bandCells(fmt, x.overall),
      medianIqr(fmt, x.overall),
      { html: `<b class="${x.consensus.status === 'retain' ? 'ok' : x.consensus.status === 'remove' ? 'bad' : 'muted'}">${STATUS_FA[x.consensus.status]}</b>${x.consensus.conflict ? ' (تعارض معیارها)' : ''}` },
    ]),
    { small: true },
  );
}

export function weightsSection(r: ReportBuilder, p: Project, w: WeightsResult = projectWeights(p)) {
  const fmt = r.fmt;
  const pname = (id: string) => p.params.find((x) => x.id === id);
  r.h2('وزن‌دهی پارامترهای مورد اجماع (روابط ۱ تا ۵)');
  r.p(
    'برای هر خبره، امتیازهای توزیع‌شده در هر سطح دوباره تا مجموع ۱ نرمال شد (رابطه ۱: وزن درون‌گروهی؛ رابطه ۲: وزن گروه، با مخرجی که فقط پارامترها و گروه‌های حفظ‌شده را دارد)، وزن کلی هر پارامتر نزد هر خبره از حاصل‌ضرب این دو به دست آمد (رابطه ۳)، سپس میانگین در هر حوزه (رابطه ۴) و میانگین حوزه‌ها (رابطه ۵) محاسبه شد.',
  );
  if (w.excluded.length)
    r.table(
      'weights-excluded',
      'خبرگانی که از وزن‌دهی کنار گذاشته شدند',
      ['خبره', 'دلیل'],
      w.excluded.map((x) => [ltr(codeOf(p, x.expertId)), EXCLUSION_FA[x.reason] + (x.groupId ? ` (${p.groups.find((g) => g.id === x.groupId)?.name ?? ''})` : '')]),
    );
  const dropped = w.perExpert.filter((e) => e.droppedGroups.length);
  if (dropped.length)
    r.note(
      `برای ${dropped.map((e) => codeOf(p, e.expertId)).join('، ')}: به گروهی امتیاز داده شده ولی به هیچ‌یک از پارامترهای حفظ‌شده آن گروه امتیازی داده نشده بود؛ طبق منطق روابط ۱ و ۲، آن گروه برای همان خبره فاقد پارامتر حفظ‌شده تلقی و سهمش به نسبت نظر همان خبره میان گروه‌های دیگر بازتوزیع شد.`,
    );
  if (w.domainsMissing.length)
    r.note(`حوزه ${w.domainsMissing.map((d) => p.domains.find((x) => x.id === d)?.name).join('، ')} خبره‌ای با توزیع معتبر ندارد؛ رابطه ۵ روی ${fmt.int(w.domainsUsed.length)} حوزه دارای داده میانگین گرفته شد.`, 'warn');
  // relation 3 per expert
  r.table(
    'weights-r3',
    'وزن کلی هر پارامتر نزد هر خبره (رابطه ۳ = رابطه ۲ × رابطه ۱)',
    ['کد', ...w.perExpert.map((e) => ltr(codeOf(p, e.expertId)))],
    [
      ...w.retainedParams.map((id) => [ltr(pname(id)?.code ?? ''), ...w.perExpert.map((e) => fmt.num(e.overall[id], 4))]),
      [{ html: '<b>Σ</b>' }, ...w.perExpert.map((e) => fmt.num(e.sum, 4))],
    ],
    { small: true, footnote: 'مجموع وزن‌های کلی هر خبره باید برابر ۱ باشد (کنترل محاسباتی).' },
  );
  const used = p.domains.filter((d) => w.domainWeights[d.id]);
  r.table(
    'weights-final',
    'وزن هر حوزه (رابطه ۴)، وزن نهایی Wᵢ (رابطه ۵) و دامنه بین چارکی وزن‌های فردی',
    ['کد', 'پارامتر', ...used.map((d) => chip(p, d.id)), 'Wᵢ', 'Wᵢ × ۱۰۰', 'Q1–Q3 وزن‌های فردی', 'IQR'],
    [
      ...w.retainedParams.map((id) => [
        ltr(pname(id)?.code ?? ''),
        { html: `<div style="text-align:right">${escapeHtml(pname(id)?.name ?? '')}</div>` },
        ...used.map((d) => fmt.num(w.domainWeights[d.id]![id], 4)),
        { html: `<b>${fmt.num(w.final[id], 4)}</b>` },
        fmt.num(100 * w.final[id], 2),
        `${fmt.num(w.agreement[id].q1, 4)}–${fmt.num(w.agreement[id].q3, 4)}`,
        fmt.num(w.agreement[id].iqr, 4),
      ]),
      [{ html: '<b>Σ</b>' }, '', ...used.map((d) => fmt.num(Object.values(w.domainWeights[d.id]!).reduce((s, x) => s + x, 0), 4)), fmt.num(w.checks.finalSum, 4), fmt.num(100 * w.checks.finalSum, 2), '', ''],
    ],
    { small: true },
  );
}

export function briefSection(r: ReportBuilder, p: Project) {
  const fmt = r.fmt;
  const w = projectWeights(p);
  const rows = round2Analysis(p);
  const retained = w.retainedParams.map((id) => p.params.find((x) => x.id === id)!).sort((a, b) => w.final[b.id] - w.final[a.id]);
  r.h2('تفهیم‌نامه طراحی (Design Brief)');
  r.table(
    'brief',
    'پارامترهای مورد اجماع، الزام طراحی متناظر و وزن نهایی',
    ['رتبه', 'کد', 'پارامتر', 'گروه معنایی', 'الزام طراحی', 'Wᵢ', 'Wᵢ × ۱۰۰', 'IQR وزن (Q1–Q3)'],
    retained.map((x, i) => [
      fmt.int(i + 1),
      ltr(x.code),
      { html: `<div style="text-align:right">${escapeHtml(x.name)}</div>` },
      p.groups.find((g) => g.id === x.groupId)?.name ?? '',
      { html: `<div style="text-align:right">${escapeHtml(x.requirement)}</div>` },
      { html: `<b>${fmt.num(w.final[x.id], 4)}</b>` },
      fmt.num(100 * w.final[x.id], 2),
      `${fmt.num(w.agreement[x.id].iqr, 4)} (${fmt.num(w.agreement[x.id].q1, 4)}–${fmt.num(w.agreement[x.id].q3, 4)})`,
    ]),
    { footnote: `مجموع وزن‌ها: ${fmt.num(w.checks.finalSum, 4)}` },
  );
  for (const status of ['remove', 'none'] as const) {
    const list = rows.filter((x) => x.consensus.status === status);
    r.table(
      `brief-${status}`,
      status === 'remove' ? 'پارامترهایی که به اجماع حذف رسیدند' : 'پارامترهای فاقد اجماع (وارد وزن‌دهی نشدند)',
      ['کد', 'پارامتر', 'الزام طراحی', ...p.scale.bands.map((b) => b.label), 'n'],
      list.length
        ? list.map((x) => [
            ltr(x.param.code),
            { html: `<div style="text-align:right">${escapeHtml(x.param.name)}</div>` },
            { html: `<div style="text-align:right">${escapeHtml(x.param.requirement)}</div>` },
            ...x.overall.percents.map((pc) => fmt.pct(pc)),
            fmt.int(x.overall.n),
          ])
        : [['—', 'موردی نیست', '', ...p.scale.bands.map(() => ''), '']],
    );
  }
}
