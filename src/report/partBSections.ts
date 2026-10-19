/** Report sections for Part B: both screening runs, forwarding, the weighted matrix, ranking and sensitivity. */
import { cellSymbol, screeningAnalysis, weightedAnalysis, type Id, type Project, type ScreeningRun } from '../core';
import { scoreChart } from '../charts/scoreChart';
import { REASON_FA } from '../screens/screeningReasons';
import { escapeHtml, type Cell, type ReportBuilder } from './html';
import { chip } from './delphiSections';

const ltr = (s: string): Cell => ({ html: `<span class="ltr">${escapeHtml(s)}</span>` });
const SYM: Record<string, string> = { '+': '+', '-': '−', S: 'S' };

export function screeningSection(r: ReportBuilder, p: Project) {
  const fmt = r.fmt;
  const a = screeningAnalysis(p);
  const cc = (id: Id) => p.concepts.find((c) => c.id === id)!;
  r.h2('غربال کانسپت‌ها با ماتریس پیو (غیروزنی)');
  r.table(
    'concepts',
    'کانسپت‌های اولیه',
    ['کد', 'نام', 'توصیف فنی', 'امکان‌پذیری فنی'],
    p.concepts.map((c) => [ltr(c.code), c.name, { html: `<div style="text-align:right">${escapeHtml(c.description)}</div>` }, c.feasible ? 'امکان‌پذیر' : 'امکان‌پذیر نیست']),
    { small: true },
  );
  if (!a.run1 || !a.run2) {
    r.p('غربال هنوز انجام نشده است.');
    return;
  }
  const raters = p.screening.mode === 'single' ? p.screening.raters.slice(0, 1) : p.screening.raters;
  r.p(
    p.screening.mode === 'single'
      ? 'ارزیابی توسط یک ارزیاب انجام شد.'
      : `ارزیابی توسط تیم پژوهش (${raters.map((x) => x.label).join('، ')}) انجام شد؛ نماد هر خانه با رأی اکثریت تعیین و در صورت تساوی آرا «S» ثبت شد. امتیاز خالص = تعداد «+» منهای تعداد «−». کانسپتی که هیچ «+» و دست‌کم یک «−» نسبت به مرجع داشت، مغلوب و حذف شد.`,
  );
  for (const run of [1, 2] as const) {
    const res = run === 1 ? a.run1 : a.run2;
    const data: ScreeningRun = run === 1 ? p.screening.run1 : a.run2UsesRun1Votes ? p.screening.run1 : p.screening.run2;
    const cols = [res.datumId, ...p.concepts.map((c) => c.id).filter((c) => c in res.totals)];
    const head: Cell[] = ['پارامتر', ...cols.map((c) => (c === res.datumId ? { html: `<span class="ltr">${escapeHtml(cc(c).code)}</span><br>(مرجع)` } : ltr(cc(c).code)))];
    const rows: Cell[][] = a.paramIds.map((pid) => [
      ltr(p.params.find((x) => x.id === pid)?.code ?? ''),
      ...cols.map((c) => (c === res.datumId ? '—' : SYM[cellSymbol(p, data, c, pid) ?? ''] ?? '')),
    ]);
    const tot = (label: string, f: (t: (typeof res.totals)[string]) => string) => [{ html: `<b>${label}</b>` }, ...cols.map((c) => (c === res.datumId ? '' : f(res.totals[c])))] as Cell[];
    rows.push(
      tot('تعداد +', (t) => fmt.int(t.plus)),
      tot('تعداد −', (t) => fmt.int(t.minus)),
      tot('تعداد S', (t) => fmt.int(t.same)),
      tot('امتیاز خالص', (t) => fmt.int(t.net)),
      tot('نتیجه', (t) => (t.dominated ? 'مغلوب — حذف' : 'باقی')),
    );
    r.table(
      `screening-run${run}`,
      run === 1 ? `ماتریس غربال پیو — اجرای اول (مرجع: ${cc(res.datumId).code}، ساده‌ترین کانسپت)` : `ماتریس غربال پیو — اجرای دوم (مرجع: کانسپت برتر اجرای اول، ${cc(res.datumId).code})`,
      head,
      rows,
      { small: true },
    );
    if (run === 1) r.p(`کانسپت برتر اجرای اول (بالاترین امتیاز خالص): ${cc(a.best!).code}${a.bestTied.length > 1 ? ` (تساوی میان ${a.bestTied.map((c) => cc(c).code).join('، ')}؛ انتخاب پژوهشگر)` : ''}.`);
    if (run === 2 && a.run2UsesRun1Votes) r.note('مرجع اجرای اول خود کانسپت برتر بود؛ آرای اجرای اول برای اجرای دوم به کار رفت.');
  }
  r.table(
    'forwarding',
    'نتیجه غربال و کانسپت‌های راه‌یافته به ماتریس وزن‌دار',
    ['کانسپت', 'نتیجه قاعده', 'امکان‌پذیری', 'تصمیم دستی (دلیل)', 'راه‌یافته'],
    a.final.map((f) => {
      const t1 = a.run1!.totals[f.conceptId];
      const t2 = a.run2!.totals[f.conceptId];
      const reason =
        f.ruleReason === 'eliminated-run1' && t1
          ? `مغلوب مرجع ${cc(a.run1!.datumId).code} در اجرای اول (بدون «+»، ${fmt.int(t1.minus)} «−»)`
          : f.ruleReason === 'dominated' && t2
            ? `مغلوب کانسپت برتر در اجرای دوم (بدون «+»، ${fmt.int(t2.minus)} «−»)`
            : REASON_FA[f.ruleReason];
      return [
        ltr(cc(f.conceptId).code),
        reason,
        cc(f.conceptId).feasible ? 'امکان‌پذیر' : 'امکان‌پذیر نیست',
        f.override ? `${f.override.forward ? 'راه یابد' : 'راه نیابد'} — ${f.override.reason || 'بدون دلیل'}` : '—',
        f.forward ? { html: '<b class="ok">بله</b>' } : 'خیر',
      ];
    }),
  );
  if (a.forward?.safetyRuleUsed)
    r.note(
      a.forward.bestDominatesAll
        ? 'کانسپت برتر همه کانسپت‌ها را مغلوب کرد؛ طبق طرح، کانسپت دارای بالاترین امتیاز خالص اجرای دوم نیز راه یافت تا ارزیابی وزنی دست‌کم میان دو گزینه انجام شود.'
        : 'کمتر از دو کانسپت راه می‌یافت؛ با تعمیم قاعده حداقل دو گزینه، کانسپت امکان‌پذیر با بالاترین امتیاز خالص اجرای دوم افزوده شد.',
    );
}

export function weightedSection(r: ReportBuilder, p: Project, partA?: Record<Id, number>) {
  const fmt = r.fmt;
  const a = weightedAnalysis(p, partA);
  const cols = p.weighted.columns;
  const cc = (id: Id) => p.concepts.find((c) => c.id === id)!;
  const pcode = (id: Id) => p.params.find((x) => x.id === id)?.code ?? '';
  r.h2('انتخاب نهایی با ماتریس پیو وزن‌دار');
  if (!cols.length || !a.conceptIds.length) {
    r.p('ماتریس وزن‌دار هنوز تکمیل نشده است.');
    return;
  }
  const single = p.weighted.mode === 'single';
  const domains = single ? [] : p.domains;
  r.p(
    single
      ? 'امتیازدهی توسط یک امتیازدهنده روی مقیاس ارزش ۵ سطحی انجام شد.'
      : `${fmt.int(a.raters.length)} عضو پنل (${p.domains.map((d) => `${d.name}: ${fmt.int(a.raters.filter((x) => x.domainId === d.id).length)}`).join('، ')}) هر کانسپت را در هر پارامتر روی مقیاس ارزش ۵ سطحی (${p.settings.valueLabels.map((l, i) => `${fmt.int(i + 1)} ${l}`).join('، ')}) به‌صورت مطلق امتیاز دادند. کانسپت‌ها با کد تصادفی و ترتیب تصادفی برای هر خبره نمایش داده شدند. امتیاز حوزه = میانه (رابطه ۶)، امتیاز تجمیعی = میانگین حوزه‌ها (رابطه ۷)، امتیاز وزنی = Σ (Wᵢ × امتیاز تجمیعی) (رابطه ۸).`,
  );
  if (!a.weightsSumToOne) r.note(`مجموع وزن‌های ستون‌ها ${fmt.num(a.weightSum, 4)} است (نه ۱).`, 'warn');
  if (!single)
    r.table(
      'weighted-domain',
      'امتیاز هر حوزه (میانه و چارک‌ها) و امتیاز تجمیعی هر کانسپت در هر پارامتر',
      ['کانسپت', 'پارامتر', ...domains.map((d) => chip(p, d.id)), 'امتیاز تجمیعی'],
      a.conceptIds.flatMap((cid) =>
        cols.map((c, i) => {
          const cell = a.result.cells[cid][c.paramId];
          return [
            i === 0 ? ltr(cc(cid).code) : '',
            ltr(pcode(c.paramId)),
            ...domains.map((d) => {
              const q = cell.byDomain[d.id];
              return q.n ? `${fmt.auto(q.median, 2)} (${fmt.auto(q.q1, 2)}–${fmt.auto(q.q3, 2)})` : '—';
            }),
            fmt.num(cell.aggregated, 2),
          ];
        }),
      ),
      { small: true, footnote: 'میانه (Q1–Q3) امتیازهای خبرگان هر حوزه، به‌عنوان شاخص توافق.' },
    );
  const rank = new Map(a.result.ranking.map((x) => [x.id, x.rank]));
  // parameters as rows and concepts as columns, so the table fits the page width however many parameters there are
  r.table(
    'weighted-final',
    'ماتریس پیو وزن‌دار: امتیاز تجمیعی، امتیاز وزنی و رتبه نهایی کانسپت‌ها',
    ['پارامتر', 'وزن (W)', ...a.conceptIds.map((cid) => ltr(cc(cid).code))],
    [
      ...cols.map((c): Cell[] => [ltr(pcode(c.paramId)), fmt.num(c.weight, 3), ...a.conceptIds.map((cid) => fmt.num(a.result.cells[cid][c.paramId].aggregated, 2))]),
      [{ html: '<b>امتیاز وزنی</b>' }, fmt.num(cols.reduce((t, c) => t + c.weight, 0), 3), ...a.conceptIds.map((cid): Cell => ({ html: `<b>${fmt.num(a.result.weighted[cid], 3)}</b>` }))],
      [{ html: '<b>رتبه</b>' }, '', ...a.conceptIds.map((cid): Cell => (rank.has(cid) ? { html: `<b>${fmt.int(rank.get(cid)!)}</b>` } : '—'))],
    ],
    { small: true, footnote: 'امتیاز هر خانه میانگین میانه‌های حوزه‌هاست (روابط ۶ و ۷)؛ امتیاز وزنی مجموع حاصل‌ضرب وزن در امتیاز تجمیعی است (رابطه ۸).' },
  );
  if (a.result.ranking.length)
    r.figure(
      'weighted-chart',
      'امتیاز وزنی کانسپت‌ها در ماتریس پیو وزن‌دار',
      scoreChart(
        a.result.ranking.map((x) => ({ label: `${cc(x.id).code} — ${cc(x.id).name}`, score: x.score, rank: x.rank })),
        fmt,
      ),
    );
  const s = a.sensitivity;
  if (!s) return;
  r.h3('تحلیل حساسیت');
  r.p(
    `اختلاف امتیاز وزنی دو کانسپت برتر (${cc(s.pair[0]).code} و ${cc(s.pair[1]).code}) ${fmt.num(s.trigger.gap, 3)} است؛ آستانه طرح (${fmt.int(p.settings.sensitivity.pctOfRange)}٪ دامنه مقیاس) ${fmt.num(s.trigger.threshold, 2)} است. شرط اجرای تحلیل حساسیت طبق پروپوزال: ${s.trigger.triggered ? 'برقرار است.' : 'برقرار نیست.'}`,
  );
  if (s.supplementary) r.note('تحلیل زیر تکمیلی است (خارج از شرط پروپوزال) و صرفاً برای اطلاع گزارش می‌شود.');
  if (s.ran) {
    const step = p.settings.sensitivity.step;
    r.table(
      'sensitivity',
      `تحلیل حساسیت تک‌عاملی: هر وزن یک بار ${fmt.int(step * 100)}٪ افزایش و یک بار ${fmt.int(step * 100)}٪ کاهش و نرمال‌سازی دوباره${s.supplementary ? ' (تکمیلی)' : ''}`,
      ['پارامتر', 'تغییر', 'رتبه‌بندی جدید (امتیاز وزنی)', 'کانسپت اول تغییر کرد؟', 'رتبه‌بندی تغییر کرد؟'],
      s.scenarios.map((sc) => [
        ltr(pcode(cols[sc.paramIndex].paramId)),
        ltr(fmt.signedPct(sc.delta * 100, 0)),
        sc.ranking.map((x) => `${cc(x.id).code} (${fmt.num(x.score, 3)})`).join(' > '),
        sc.topChanged ? { html: '<b class="bad">بله</b>' } : 'خیر',
        sc.rankingChanged ? { html: '<b>بله</b>' } : 'خیر',
      ]),
      { small: true },
    );
  }
  r.table(
    'break-even',
    `نقطه سربه‌سر (تکمیلی): کمترین تغییر نسبی وزن هر پارامتر که ${cc(s.pair[1]).code} را با ${cc(s.pair[0]).code} برابر می‌کند`,
    ['پارامتر', 'تغییر لازم در وزن', 'وضعیت'],
    s.breakEven.map((b, i) => [
      ltr(pcode(cols[i].paramId)),
      b.delta === null ? '—' : ltr(fmt.signedPct(b.delta * 100, 1)),
      b.delta === null ? 'امتیاز دو کانسپت در این پارامتر برابر است' : b.possible ? 'ممکن' : 'ناممکن (نیازمند وزن منفی)',
    ]),
    { small: true },
  );
}
